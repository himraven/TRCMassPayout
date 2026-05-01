import { db } from '../../db/schema'
import { batchManager } from '../batch'
import type {
  ExecutionSettings,
  IChainWatcher,
  PayoutErrorCode,
  TransactionStatusResult,
  WatcherListener,
} from '../../types'
import { eventBus } from '../../utils/eventBus'
import { createExplorerUrl, decodeHexMessage } from '../../utils/tron'

const TRONGRID_BASE_URL = 'https://api.trongrid.io/v1/transactions'
const INITIAL_POLL_MS = 3_000
const MAX_POLL_MS = 60_000
const BACKOFF_FACTOR = 1.5
const DEFAULT_CONFIRM_TIMEOUT_MINUTES = 10

function delay(timeoutMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, timeoutMs)
  })
}

function mapReceiptResult(
  receiptResult?: string,
  contractResult?: string[],
) {
  const normalized = receiptResult?.toUpperCase()
  const revertedMessage =
    decodeHexMessage(contractResult?.[0]) ?? decodeHexMessage(receiptResult ?? null)

  if (normalized === 'SUCCESS') {
    return {
      status: 'Success' as const,
      errorCode: undefined,
      errorMessage: undefined,
    }
  }

  if (normalized === 'OUT_OF_ENERGY') {
    return {
      status: 'Failed' as const,
      errorCode: 'INSUFFICIENT_ENERGY' as PayoutErrorCode,
      errorMessage: 'Transaction failed with OUT_OF_ENERGY',
    }
  }

  if (normalized === 'OUT_OF_BANDWIDTH_ERROR' || normalized === 'BANDWITH_ERROR') {
    return {
      status: 'Failed' as const,
      errorCode: 'INSUFFICIENT_BANDWIDTH' as PayoutErrorCode,
      errorMessage: 'Transaction failed with insufficient bandwidth',
    }
  }

  if (normalized === 'REVERT') {
    return {
      status: 'Failed' as const,
      errorCode: 'CONTRACT_REVERTED' as PayoutErrorCode,
      errorMessage: revertedMessage ?? 'Transaction reverted',
    }
  }

  if (normalized) {
    return {
      status: 'Failed' as const,
      errorCode: 'BROADCAST_REJECTED' as PayoutErrorCode,
      errorMessage: revertedMessage ?? `Transaction failed with ${normalized}`,
    }
  }

  return {
    status: 'Confirming' as const,
    errorCode: undefined,
    errorMessage: undefined,
  }
}

type TronGridTransactionInfo = {
  blockNumber?: number
  block_timestamp?: number
  receipt?: {
    result?: string
  }
  resMessage?: string
  contractResult?: string[]
}

export class ChainWatcherService implements IChainWatcher {
  private listeners = new Set<WatcherListener>()
  private activeWatches = new Map<string, Promise<void>>()

  async watch(
    txId: string,
    payoutItemId: string,
    batchId: string,
    settings?: Pick<ExecutionSettings, 'confirmationTimeoutMinutes'>,
  ) {
    const key = `${payoutItemId}:${txId}`

    if (this.activeWatches.has(key)) {
      await this.activeWatches.get(key)
      return
    }

    const watchPromise = this.runWatch(txId, payoutItemId, batchId, settings).finally(() => {
      this.activeWatches.delete(key)
    })

    this.activeWatches.set(key, watchPromise)
    await watchPromise
  }

  async getConfirmation(txId: string): Promise<TransactionStatusResult> {
    const response = await fetch(`${TRONGRID_BASE_URL}/${txId}/info`)

    if (!response.ok) {
      throw new Error(`Failed to fetch transaction info (${response.status})`)
    }

    const payload = (await response.json()) as {
      data?: TronGridTransactionInfo[]
    }
    const info = payload.data?.[0]
    const mapped = mapReceiptResult(info?.receipt?.result, info?.contractResult)

    return {
      txId,
      status: mapped.status,
      updatedAt: new Date().toISOString(),
      explorerUrl: createExplorerUrl(txId),
      errorCode: mapped.errorCode,
      errorMessage:
        mapped.errorMessage ??
        decodeHexMessage(info?.resMessage) ??
        decodeHexMessage(info?.contractResult?.[0]) ??
        undefined,
      blockNumber: info?.blockNumber ?? null,
      timestamp: info?.block_timestamp ?? null,
    }
  }

  subscribe(listener: WatcherListener) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private async runWatch(
    txId: string,
    payoutItemId: string,
    batchId: string,
    settings?: Pick<ExecutionSettings, 'confirmationTimeoutMinutes'>,
  ) {
    const timeoutMs =
      (settings?.confirmationTimeoutMinutes ?? DEFAULT_CONFIRM_TIMEOUT_MINUTES) *
      60_000
    const startedAt = Date.now()
    let intervalMs = INITIAL_POLL_MS

    while (Date.now() - startedAt <= timeoutMs) {
      try {
        const confirmation = await this.getConfirmation(txId)

        if (confirmation.status === 'Confirming') {
          await this.markConfirming(payoutItemId, txId)
          await delay(intervalMs)
          intervalMs = Math.min(Math.round(intervalMs * BACKOFF_FACTOR), MAX_POLL_MS)
          continue
        }

        await this.applyTerminalState(batchId, payoutItemId, confirmation)
        return
      } catch {
        await delay(intervalMs)
        intervalMs = Math.min(Math.round(intervalMs * BACKOFF_FACTOR), MAX_POLL_MS)
      }
    }

    await this.applyTerminalState(batchId, payoutItemId, {
      txId,
      status: 'Failed',
      updatedAt: new Date().toISOString(),
      explorerUrl: createExplorerUrl(txId),
      errorCode: 'CONFIRM_TIMEOUT',
      errorMessage: 'Transaction confirmation timed out',
      blockNumber: null,
      timestamp: null,
    })
  }

  private async markConfirming(payoutItemId: string, txId: string) {
    const item = await db.payoutItems.get(payoutItemId)

    if (!item || ['Success', 'Failed'].includes(item.status)) {
      return
    }

    if (item.status !== 'Confirming') {
      await db.payoutItems.update(payoutItemId, {
        status: 'Confirming',
        txId,
        explorerUrl: createExplorerUrl(txId),
        updatedAt: new Date().toISOString(),
      })
    }
  }

  private async applyTerminalState(
    batchId: string,
    payoutItemId: string,
    confirmation: TransactionStatusResult,
  ) {
    const item = await db.payoutItems.get(payoutItemId)

    if (!item) {
      return
    }

    if (item.status === confirmation.status && item.confirmedAt) {
      return
    }

    const confirmedAt = new Date().toISOString()

    await db.payoutItems.update(payoutItemId, {
      status: confirmation.status,
      txId: confirmation.txId,
      explorerUrl: confirmation.explorerUrl,
      errorCode: confirmation.errorCode ?? null,
      errorMessage: confirmation.errorMessage ?? null,
      confirmedAt,
      updatedAt: confirmedAt,
    })

    const listenerEvent = {
      ...confirmation,
      payoutItemId,
      batchId,
    }

    this.listeners.forEach((listener) => listener(listenerEvent))

    if (confirmation.status === 'Success') {
      eventBus.emit('payout.success', {
        itemId: payoutItemId,
        batchId,
        txId: confirmation.txId,
        blockNumber: confirmation.blockNumber ?? null,
        timestamp: confirmation.timestamp ?? null,
      })
    } else {
      eventBus.emit('payout.failed', {
        itemId: payoutItemId,
        batchId,
        txId: confirmation.txId,
        errorCode: confirmation.errorCode ?? null,
        errorMessage: confirmation.errorMessage ?? null,
        blockNumber: confirmation.blockNumber ?? null,
        timestamp: confirmation.timestamp ?? null,
      })
    }

    const terminalStatus = confirmation.status === 'Success' ? 'Success' : 'Failed'

    eventBus.emit('payout.confirmed', {
      itemId: payoutItemId,
      batchId,
      txId: confirmation.txId,
      status: terminalStatus,
      blockNumber: confirmation.blockNumber ?? null,
      timestamp: confirmation.timestamp ?? null,
      errorCode: confirmation.errorCode ?? null,
      errorMessage: confirmation.errorMessage ?? null,
    })

    const progress = await batchManager.getBatchProgress(batchId)
    await batchManager.updateBatch(batchId, {
      successCount: progress.success,
      failedCount: progress.failed,
      lifecycle:
        progress.total > 0 && progress.terminal === progress.total ? 'Completed' : 'Paying',
      status:
        progress.total > 0 && progress.terminal === progress.total
          ? 'Completed'
          : confirmation.status === 'Success'
            ? 'Confirming'
            : 'Failed items detected',
      completedAt:
        progress.total > 0 && progress.terminal === progress.total
          ? new Date().toISOString()
          : null,
    })

    eventBus.emit('batch.progress', { batchId, progress })

    if (progress.total > 0 && progress.terminal === progress.total) {
      const completedAt = new Date().toISOString()
      eventBus.emit('batch.completed', {
        batchId,
        successCount: progress.success,
        failedCount: progress.failed,
        completedAt,
      })
      eventBus.emit('batch_completed', {
        batchId,
        successCount: progress.success,
        failedCount: progress.failed,
        completedAt,
      })
    }
  }
}

export const chainWatcher = new ChainWatcherService()