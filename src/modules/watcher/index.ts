import type {
  IChainWatcher,
  TransactionStatusResult,
  WatcherListener,
} from '../../types'
import { eventBus } from '../../utils/eventBus'
import { createExplorerUrl } from '../../utils/tron'

export class ChainWatcherService implements IChainWatcher {
  private listeners = new Set<WatcherListener>()

  async watch(txId: string, payoutItemId: string) {
    const update = await this.getConfirmation(txId)
    this.listeners.forEach((listener) => listener({ ...update, payoutItemId }))
    eventBus.emit('payout.confirming', { txId, payoutItemId })
  }

  async getConfirmation(txId: string): Promise<TransactionStatusResult> {
    return {
      txId,
      status: 'Confirming',
      explorerUrl: createExplorerUrl(txId),
      updatedAt: new Date().toISOString(),
    }
  }

  subscribe(listener: WatcherListener) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const chainWatcher = new ChainWatcherService()