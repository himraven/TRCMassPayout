type EventPayload = Record<string, unknown>

type EventMap = {
  'wallet.connected': EventPayload
  'wallet.disconnected': EventPayload
  'batch.created': EventPayload
  'batch.validated': EventPayload
  'payout.signed': EventPayload
  'payout.broadcast': EventPayload
  'payout.confirming': EventPayload
  'payout.success': EventPayload
  'payout.failed': EventPayload
  'receipt.generated': EventPayload
  'export.completed': EventPayload
}

class EventBus {
  private listeners = new Map<keyof EventMap, Set<(payload: EventPayload) => void>>()

  emit<T extends keyof EventMap>(event: T, payload: EventMap[T]) {
    this.listeners.get(event)?.forEach((listener) => listener(payload))
  }

  subscribe<T extends keyof EventMap>(
    event: T,
    listener: (payload: EventMap[T]) => void,
  ) {
    const existing = this.listeners.get(event) ?? new Set()
    existing.add(listener as (payload: EventPayload) => void)
    this.listeners.set(event, existing)

    return () => {
      existing.delete(listener as (payload: EventPayload) => void)
    }
  }
}

export const eventBus = new EventBus()