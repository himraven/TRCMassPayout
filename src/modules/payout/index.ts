import { db } from '../../db/schema'
import { batchManager } from '../batch'
import { walletService } from '../wallet'
import { chainWatcher } from '../watcher'
import type {
  BroadcastResult,
  BuildTransactionInput,
  ExecutionSettings,
  IPayoutEngine,
  PayoutErrorCode,
  PayoutItemRecord,
  TransactionStatusResult,
  TronSignedTransaction,
  TronUnsignedTransaction,
} from '../../types'
import { eventBus } from '../../utils/eventBus'
import {
  amountToTokenUnits,
  createExplorerUrl,
  decodeHexMessage,
  trxToSun,
} from '../../utils/tron'

const DEFAULT_FEE_LIMIT_TRX = 150
const ENERGY_PER_TRANSFER = 65_000
const NETWORK_RETRY_LIMIT = 3
const NETWORK_RETRY_DELAY_MS = 2_000

function delay(timeoutMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, timeoutMs)
  })
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unknown payout error'
}

function isUserRejectedError(message: string) {
  return /(user rejected|cancelled|canceled|declined|denied|rejected)/i.test(message)
}

function isNetworkError(message: string) {
  return /(network|fetch|timeout|socket|503|504|connection|disconnected)/i.test(
    message,
  )
}

function mapErrorCode(message: string): PayoutErrorCode {
  if (isUserRejectedError(message)) {
    return 'USER_REJECTED'
  }

  if (/insufficient balance|balance is not sufficient|insufficient token/i.test(message)) {
    return 'INSUFFICIENT_BALANCE'
  }

  if (/out of energy|energy/i.test(message)) {
    return 'INSUFFICIENT_ENERGY'
  }

  if (/bandwidth/i.test(message)) {
    return 'INSUFFICIENT_BANDWIDTH'
  }

  if (/revert/i.test(message)) {
    return 'CONTRACT_REVERTED'
  }

  if (isNetworkError(message)) {
    return 'NETWORK_ERROR'
  }

  return 'BROADCAST_REJECTED'
}

type ActiveProcess = {
  batchId: string
  promise: Promise<void>
}

export class TronLinkPayoutProvider implements IPayoutEngine {
  private itemLocks = new Set<string>()
  private activeProcesses = new Map<string, ActiveProcess>()
  private pausedBatches = new Set<string>()
  private runners = new Map<string, Promise<void>>()

  async buildTransaction(
    input: BuildTransactionInput,
  ): Promise<TronUnsignedTransaction> {
    const tronWeb = window.tronWeb as
      | (Window['tronWeb'] & {
          address: { toHex: (address: string) => string }
          transactionBuilder: {
            triggerSmartContract: (
              contractAddress: string,
              functionSelector: string,
              options: { feeLimit: number; callValue: number },
              parameters: Array<{ type: string; value: string }>,
              ownerAddress: string,
            ) => Promise<{
              result?: { result?: boolean; message?: string }
              transaction?: TronUnsignedTransaction
            }>
          }
        })
      | undefined

    if (!tronWeb?.transactionBuilder?.triggerSmartContract || !tronWeb.address?.toHex) {
      throw new Error('TronLink is unavailable for transaction building')
    }

    const response = await tronWeb.transactionBuilder.triggerSmartContract(
      tronWeb.address.toHex(input.tokenContract),
      'transfer(address,uint256)',
      {
        feeLimit: input.feeLimitSun ?? trxToSun(DEFAULT_FEE_LIMIT_TRX),
        callValue: 0,
      },
      [
        {
          type: 'address',
          value: input.recipient,
        },
        {
          type: 'uint256',
          value: amountToTokenUnits(input.amount),
        },
      ],
      tronWeb.address.toHex(input.sender),
    )

    if (!response.transaction || response.result?.result === false) {
      throw new Error(
        decodeHexMessage(response.result?.message) ?? 'Failed to build TRC-20 transfer',
      )
    }

    return response.transaction
  }

  async sign(
    unsignedTransaction: TronUnsignedTransaction,
  ): Promise<TronSignedTransaction> {
    if (!window.tronWeb?.trx?.sign) {
      throw new Error('TronLink is unavailable for signing')
    }

    const signed = await window.tronWeb.trx.sign(unsignedTransaction)

    return signed as TronSignedTransaction
  }

  async broadcast(
    signedTransaction: TronSignedTransaction,
  ): Promise<BroadcastResult> {
    if (!window.tronWeb?.trx?.sendRawTransaction) {
      throw new Error('TronLink is unavailable for broadcasting')
    }

    const result = await window.tronWeb.trx.sendRawTransaction(signedTransaction)
    const txId = result.txid ?? signedTransaction.txID ?? crypto.randomUUID()

    if (result.result === false || result.code) {
      throw new Error(
        decodeHexMessage(result.message) ??
          String(result.code ?? 'Broadcast rejected by node'),
      )
    }

    return {
      txId,
      accepted: true,
      explorerUrl: createExplorerUrl(txId),
    }
  }

  async getStatus(txId: string): Promise<TransactionStatusResult> {
    return chainWatcher.getConfirmation(txId)
  }

  async startBatch(batchId: string, settings: ExecutionSettings) {
    const batch = await batchManager.getBatch(batchId)

    if (!batch) {
      throw new Error(`Batch ${batchId} not found`)
    }

    this.pausedBatches.delete(batchId)

    await batchManager.updateBatch(batchId, {
      lifecycle: 'Paying',
      status: 'Running',
      concurrency: settings.concurrency,
      startedAt: batch.startedAt ?? new Date().toISOString(),
      completedAt: null,
    })

    await this.syncBatch(batchId)
    this.ensureRunner(batchId, settings)
  }

  async pauseBatch(batchId: string, reason = 'Paused by user') {
    this.pausedBatches.add(batchId)
    await batchManager.updateBatch(batchId, {
      lifecycle: 'Paying',
      status: reason,
    })
    eventBus.emit('batch.paused', { batchId, reason })
    await this.syncBatch(batchId)
  }

  async resumeBatch(batchId: string, settings: ExecutionSettings) {
    this.pausedBatches.delete(batchId)
    await batchManager.updateBatch(batchId, {
      lifecycle: 'Paying',
      status: 'Running',
      concurrency: settings.concurrency,
    })
    eventBus.emit('batch.resumed', { batchId })
    await this.syncBatch(batchId)
    this.ensureRunner(batchId, settings)
  }

  async retryFailed(
    batchId: string,
    itemIds: string[],
    settings: ExecutionSettings,
  ) {
    if (itemIds.length === 0) {
      return
    }

    const items = await db.payoutItems.where('id').anyOf(itemIds).toArray()
    const now = new Date().toISOString()

    await db.transaction('rw', [db.payoutItems], async () => {
      await Promise.all(
        items
          .filter((item) => item.batchId === batchId && item.status === 'Failed')
          .map((item) =>
            db.payoutItems.update(item.id, {
              status: 'Pending',
              errorCode: null,
              errorMessage: null,
              txId: null,
              explorerUrl: null,
              signedAt: null,
              broadcastAt: null,
              confirmedAt: null,
              updatedAt: now,
            }),
          ),
      )
    })

    await this.resumeBatch(batchId, settings)
  }

  async recover(settings: ExecutionSettings) {
    const items = await db.payoutItems.toArray()
    const signingItems = items.filter((item) => item.status === 'Signing')
    const broadcastItems = items.filter((item) => item.status === 'Broadcast')
    const confirmingItems = items.filter((item) => item.status === 'Confirming')
    const now = new Date().toISOString()

    await db.transaction('rw', [db.payoutItems], async () => {
      await Promise.all(
        signingItems.map((item) =>
          db.payoutItems.update(item.id, {
            status: 'Pending',
            txId: null,
            explorerUrl: null,
            updatedAt: now,
          }),
        ),
      )

      await Promise.all(
        broadcastItems.map((item) =>
          db.payoutItems.update(item.id, {
            status: item.txId ? 'Confirming' : 'Pending',
            updatedAt: now,
          }),
        ),
      )
    })

    await Promise.all(
      [...broadcastItems, ...confirmingItems]
        .filter((item) => item.txId)
        .map((item) =>
          chainWatcher.watch(item.txId!, item.id, item.batchId, {
            confirmationTimeoutMinutes: settings.confirmationTimeoutMinutes,
          }),
        ),
    )

    if (!settings.resumeOnReload) {
      return
    }

    const batches = await batchManager.listBatches()
    await Promise.all(
      batches
        .filter((batch) => batch.lifecycle === 'Paying')
        .map((batch) => this.resumeBatch(batch.id, settings)),
    )
  }

  private ensureRunner(batchId: string, settings: ExecutionSettings) {
    if (this.runners.has(batchId)) {
      return
    }

    const runner = this.processBatch(batchId, settings).finally(() => {
      this.runners.delete(batchId)
    })

    this.runners.set(batchId, runner)
  }

  private async processBatch(batchId: string, settings: ExecutionSettings) {
    while (!this.pausedBatches.has(batchId)) {
      const activeCount = this.getActiveCount(batchId)
      if (activeCount >= settings.concurrency) {
        await Promise.race(this.getActivePromises(batchId))
        continue
      }

      const candidates = (
        await db.payoutItems
          .where('[batchId+status]')
          .equals([batchId, 'Pending'])
          .limit(Math.max(settings.concurrency, 1) * 2)
          .toArray()
      )
        .filter((item) => !this.itemLocks.has(item.id))
        .slice(0, settings.concurrency - activeCount)

      if (candidates.length === 0) {
        const running = this.getActivePromises(batchId)

        if (running.length > 0) {
          await Promise.race(running)
          continue
        }

        await this.syncBatch(batchId)
        return
      }

      candidates.forEach((item) => {
        this.spawnProcess(item, settings)
      })
    }
  }

  private spawnProcess(item: PayoutItemRecord, settings: ExecutionSettings) {
    if (this.itemLocks.has(item.id)) {
      return
    }

    this.itemLocks.add(item.id)

    const promise = this.processItem(item, settings)
      .catch(async (error) => {
        const message = extractErrorMessage(error)
        await this.failItem(item, mapErrorCode(message), message)
      })
      .finally(async () => {
        this.itemLocks.delete(item.id)
        this.activeProcesses.delete(item.id)
        await this.syncBatch(item.batchId)
      })

    this.activeProcesses.set(item.id, {
      batchId: item.batchId,
      promise,
    })
  }

  private async processItem(item: PayoutItemRecord, settings: ExecutionSettings) {
    const latest = await db.payoutItems.get(item.id)

    if (!latest) {
      return
    }

    if (['Broadcast', 'Confirming', 'Success'].includes(latest.status)) {
      if (latest.status === 'Confirming' && latest.txId) {
        await chainWatcher.watch(latest.txId, latest.id, latest.batchId, {
          confirmationTimeoutMinutes: settings.confirmationTimeoutMinutes,
        })
      }
      return
    }

    if (latest.status !== 'Pending') {
      return
    }

    const batch = await batchManager.getBatch(latest.batchId)

    if (!batch) {
      throw new Error(`Batch ${latest.batchId} not found for payout item ${latest.id}`)
    }

    await this.assertFundsAvailable(batch.senderAddress, latest, batch.id, settings)

    const unsigned = await this.buildTransaction({
      sender: batch.senderAddress,
      recipient: latest.recipient,
      amount: latest.amount,
      tokenContract: batch.tokenContract,
      feeLimitSun: trxToSun(settings.feeLimitTrx),
    })

    await this.transitionItem(latest.id, batch.id, 'Signing', {
      errorCode: null,
      errorMessage: null,
      explorerUrl: null,
      txId: null,
      attemptCount: latest.attemptCount + 1,
    })

    let signed: TronSignedTransaction

    try {
      signed = await this.sign(unsigned)
    } catch (error) {
      const message = extractErrorMessage(error)
      await this.failItem(latest, mapErrorCode(message), message)
      return
    }

    await this.transitionItem(latest.id, batch.id, 'Broadcast', {
      txId: signed.txID ?? null,
      explorerUrl: signed.txID ? createExplorerUrl(signed.txID) : null,
      signedAt: new Date().toISOString(),
    })

    try {
      const broadcast = await this.broadcastWithRetry(signed)

      await this.transitionItem(latest.id, batch.id, 'Confirming', {
        txId: broadcast.txId,
        explorerUrl: broadcast.explorerUrl,
        broadcastAt: new Date().toISOString(),
      })

      void chainWatcher.watch(broadcast.txId, latest.id, batch.id, {
        confirmationTimeoutMinutes: settings.confirmationTimeoutMinutes,
      })
    } catch (error) {
      const message = extractErrorMessage(error)
      await this.failItem(latest, mapErrorCode(message), message)
    }
  }

  private async broadcastWithRetry(signed: TronSignedTransaction) {
    let attempt = 0

    while (attempt < NETWORK_RETRY_LIMIT) {
      try {
        return await this.broadcast(signed)
      } catch (error) {
        const message = extractErrorMessage(error)
        attempt += 1

        if (!isNetworkError(message) || attempt >= NETWORK_RETRY_LIMIT) {
          throw error
        }

        await delay(NETWORK_RETRY_DELAY_MS)
      }
    }

    throw new Error('Broadcast failed after retry limit')
  }

  private async assertFundsAvailable(
    senderAddress: string,
    item: PayoutItemRecord,
    batchId: string,
    settings: ExecutionSettings,
  ) {
    const balance = await walletService.getBalance(senderAddress)
    const usdtBalance = Number(balance.usdtBalance)

    if (usdtBalance < Number(item.amount)) {
      await this.failItem(
        item,
        'INSUFFICIENT_BALANCE',
        'Insufficient USDT balance for this payout item',
      )
      await this.pauseBatch(batchId, 'Insufficient USDT balance detected')
      return
    }

    if (
      balance.energyAvailable < ENERGY_PER_TRANSFER &&
      Number(balance.trxBalanceSun) < trxToSun(Math.max(settings.feeLimitTrx, 1))
    ) {
      await this.failItem(
        item,
        'INSUFFICIENT_ENERGY',
        'Insufficient TRX / energy to continue the batch',
      )
      await this.pauseBatch(batchId, 'Insufficient TRX / energy detected')
    }
  }

  private async transitionItem(
    itemId: string,
    batchId: string,
    status: PayoutItemRecord['status'],
    changes: Partial<PayoutItemRecord>,
  ) {
    await batchManager.updatePayoutItem(itemId, {
      ...changes,
      status,
    })

    const updated = await db.payoutItems.get(itemId)

    if (!updated) {
      return
    }

    eventBus.emit('payout.updated', {
      itemId,
      batchId,
      status,
      txId: updated.txId,
      errorCode: updated.errorCode,
      errorMessage: updated.errorMessage,
    })

    if (status === 'Signing') {
      eventBus.emit('payout.signing', { itemId, batchId })
    } else if (status === 'Broadcast') {
      eventBus.emit('payout.broadcast', {
        itemId,
        batchId,
        txId: updated.txId,
      })
    } else if (status === 'Confirming' && updated.txId) {
      eventBus.emit('payout.confirming', {
        itemId,
        batchId,
        txId: updated.txId,
      })
    }

    await this.syncBatch(batchId)
  }

  private async failItem(
    item: Pick<PayoutItemRecord, 'id' | 'batchId'>,
    errorCode: PayoutErrorCode,
    errorMessage: string,
  ) {
    const existing = await db.payoutItems.get(item.id)

    if (!existing || existing.status === 'Success') {
      return
    }

    await batchManager.updatePayoutItem(item.id, {
      status: 'Failed',
      errorCode,
      errorMessage,
      confirmedAt: new Date().toISOString(),
    })

    const updated = await db.payoutItems.get(item.id)

    if (!updated) {
      return
    }

    eventBus.emit('payout.updated', {
      itemId: item.id,
      batchId: item.batchId,
      status: 'Failed',
      txId: updated.txId,
      errorCode,
      errorMessage,
    })
    eventBus.emit('payout.failed', {
      itemId: item.id,
      batchId: item.batchId,
      txId: updated.txId,
      errorCode,
      errorMessage,
    })
    await this.syncBatch(item.batchId)
  }

  private async syncBatch(batchId: string) {
    const [batch, progress] = await Promise.all([
      batchManager.getBatch(batchId),
      batchManager.getBatchProgress(batchId),
    ])

    if (!batch) {
      return
    }

    const allTerminal = progress.total > 0 && progress.terminal === progress.total
    const completedAt = allTerminal ? new Date().toISOString() : null
    const status = allTerminal
      ? 'Completed'
      : this.pausedBatches.has(batchId)
        ? batch.status
        : progress.signing > 0
          ? 'Signing'
          : progress.broadcast > 0
            ? 'Broadcasting'
            : progress.confirming > 0
              ? 'Confirming'
              : progress.pending < progress.total
                ? 'Queued'
                : batch.lifecycle === 'Validated'
                  ? batch.status
                  : 'Pending'

    await batchManager.updateBatch(batchId, {
      lifecycle: allTerminal ? 'Completed' : batch.lifecycle === 'Validated' ? 'Paying' : batch.lifecycle,
      successCount: progress.success,
      failedCount: progress.failed,
      completedAt,
      status,
    })

    eventBus.emit('batch.progress', {
      batchId,
      progress,
    })

    if (allTerminal && batch.lifecycle !== 'Completed') {
      eventBus.emit('batch.completed', {
        batchId,
        successCount: progress.success,
        failedCount: progress.failed,
        completedAt: completedAt ?? new Date().toISOString(),
      })
      eventBus.emit('batch_completed', {
        batchId,
        successCount: progress.success,
        failedCount: progress.failed,
        completedAt: completedAt ?? new Date().toISOString(),
      })
    }
  }

  private getActiveCount(batchId: string) {
    return [...this.activeProcesses.values()].filter(
      (entry) => entry.batchId === batchId,
    ).length
  }

  private getActivePromises(batchId: string) {
    return [...this.activeProcesses.values()]
      .filter((entry) => entry.batchId === batchId)
      .map((entry) => entry.promise)
  }
}

export class ReservedModeAPayoutProvider implements IPayoutEngine {
  async buildTransaction(): Promise<TronUnsignedTransaction> {
    throw new Error('Mode A is reserved and not enabled in V1')
  }

  async sign(): Promise<TronSignedTransaction> {
    throw new Error('Mode A is reserved and not enabled in V1')
  }

  async broadcast(): Promise<BroadcastResult> {
    throw new Error('Mode A is reserved and not enabled in V1')
  }

  async getStatus(txId: string): Promise<TransactionStatusResult> {
    return {
      txId,
      status: 'Failed',
      updatedAt: new Date().toISOString(),
      errorCode: 'BROADCAST_REJECTED',
      explorerUrl: createExplorerUrl(txId),
    }
  }

  async startBatch(): Promise<void> {
    throw new Error('Mode A is reserved and not enabled in V1')
  }

  async pauseBatch(): Promise<void> {
    throw new Error('Mode A is reserved and not enabled in V1')
  }

  async resumeBatch(): Promise<void> {
    throw new Error('Mode A is reserved and not enabled in V1')
  }

  async retryFailed(): Promise<void> {
    throw new Error('Mode A is reserved and not enabled in V1')
  }

  async recover(): Promise<void> {
    return Promise.resolve()
  }
}

export const payoutProvider = new TronLinkPayoutProvider()
export const payoutEngine = payoutProvider