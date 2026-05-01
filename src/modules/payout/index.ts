import type {
  BroadcastResult,
  BuildTransactionInput,
  PayoutProvider,
  TransactionStatusResult,
  TronSignedTransaction,
  TronUnsignedTransaction,
} from '../../types'
import { createExplorerUrl } from '../../utils/tron'

export class TronLinkPayoutProvider implements PayoutProvider {
  async buildTransaction(
    input: BuildTransactionInput,
  ): Promise<TronUnsignedTransaction> {
    return {
      rawData: {
        contractAddress: input.tokenContract,
        ownerAddress: input.sender,
        toAddress: input.recipient,
        amount: input.amount,
      },
    }
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

    return {
      txId,
      accepted: Boolean(result.result ?? result.code === undefined),
      explorerUrl: createExplorerUrl(txId),
    }
  }

  async getStatus(txId: string): Promise<TransactionStatusResult> {
    return {
      txId,
      status: 'Confirming',
      explorerUrl: createExplorerUrl(txId),
      updatedAt: new Date().toISOString(),
    }
  }
}

export class ReservedModeAPayoutProvider implements PayoutProvider {
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
}

export const payoutProvider = new TronLinkPayoutProvider()