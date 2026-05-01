import { useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'

export function useBatches() {
  const batches = useAppStore((state) => state.batches)

  return useMemo(
    () => ({
      batches,
      activeCount: batches.filter((batch) => batch.lifecycle === 'Paying').length,
      completedCount: batches.filter((batch) => batch.lifecycle === 'Completed')
        .length,
    }),
    [batches],
  )
}