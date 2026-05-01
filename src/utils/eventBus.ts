import type {
  BatchProgress,
  PayoutErrorCode,
  PayoutItemStatus,
} from '../types'

type EventMap = {
  'wallet.connected': { address?: string; network?: string }
  'wallet.disconnected': { address?: string | null }
  'batch.created': { batchId: string }
  'batch.validated': { batchId: string }
  'batch.progress': { batchId: string; progress: BatchProgress }
  'batch.paused': {
    batchId: string
    reason: string
    errorCode?: PayoutErrorCode
  }
  'batch.resumed': { batchId: string }
  'batch.completed': {
    batchId: string
    successCount: number
    failedCount: number
    completedAt: string
  }
  batch_completed: {
    batchId: string
    successCount: number
    failedCount: number
    completedAt: string
  }
  'payout.updated': {
    itemId: string
    batchId: string
    status: PayoutItemStatus
    txId: string | null
    errorCode: PayoutErrorCode | null
    errorMessage: string | null
  }
  'payout.signing': { itemId: string; batchId: string }
  'payout.broadcast': { itemId: string; batchId: string; txId: string | null }
  'payout.confirming': { itemId: string; batchId: string; txId: string }
  'payout.success': {
    itemId: string
    batchId: string
    txId: string
    blockNumber: number | null
    timestamp: number | null
  }
  'payout.failed': {
    itemId: string
    batchId: string
    txId: string | null
    errorCode: PayoutErrorCode | null
    errorMessage: string | null
    blockNumber?: number | null
    timestamp?: number | null
  }
  'payout.confirmed': {
    itemId: string
    batchId: string
    txId: string
    status: 'Success' | 'Failed'
    blockNumber: number | null
    timestamp: number | null
    errorCode: PayoutErrorCode | null
    errorMessage: string | null
  }
  'receipt.generated': { receiptId: string; batchId: string; payoutItemId: string }
  'export.completed': { batchId: string; format: string }
}

class EventBus {
  private listeners = new Map<
    keyof EventMap,
    Set<(payload: EventMap[keyof EventMap]) => void>
  >()

  emit<T extends keyof EventMap>(event: T, payload: EventMap[T]) {
    this.listeners.get(event)?.forEach((listener) => listener(payload))
  }

  subscribe<T extends keyof EventMap>(
    event: T,
    listener: (payload: EventMap[T]) => void,
  ) {
    const existing = this.listeners.get(event) ?? new Set()
    existing.add(listener as (payload: EventMap[keyof EventMap]) => void)
    this.listeners.set(
      event,
      existing as Set<(payload: EventMap[keyof EventMap]) => void>,
    )

    return () => {
      existing.delete(listener as (payload: EventMap[keyof EventMap]) => void)
    }
  }
}

export const eventBus = new EventBus()