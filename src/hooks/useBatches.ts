import { useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'

export function useBatches() {
  const batches = useAppStore((state) => state.batches)
  const refreshBatches = useAppStore((state) => state.refreshBatches)

  useEffect(() => {
    void refreshBatches()
  }, [refreshBatches])

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