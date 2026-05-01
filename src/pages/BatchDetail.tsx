import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SectionCard } from '../components/SectionCard'
import { StatusBadge } from '../components/StatusBadge'
import { batchManager } from '../modules/batch'
import { eventBus } from '../utils/eventBus'
import { useAppStore } from '../stores/useAppStore'
import { maskAddress } from '../utils/tron'
import { useWallet } from '../hooks/useWallet'
import type { BatchRecord, PayoutItemRecord } from '../types'

export function BatchDetail() {
  const { batchId } = useParams()
  const wallet = useWallet()
  const settings = useAppStore((state) => state.settings)
  const execution = useAppStore((state) => state.batchExecutionState)
  const startBatch = useAppStore((state) => state.startBatch)
  const pauseBatch = useAppStore((state) => state.pauseBatch)
  const resumeBatch = useAppStore((state) => state.resumeBatch)
  const retryFailed = useAppStore((state) => state.retryFailed)
  const refreshExecutionProgress = useAppStore(
    (state) => state.refreshExecutionProgress,
  )
  const [batch, setBatch] = useState<BatchRecord | null>(null)
  const [items, setItems] = useState<PayoutItemRecord[]>([])
  const [selectedFailedIds, setSelectedFailedIds] = useState<string[]>([])

  const activeBatchId = batch?.id ?? batchId ?? null

  const loadBatch = useCallback(async () => {
    if (!batchId) {
      return
    }

    const [nextBatch, nextItems] = await Promise.all([
      batchManager.getBatch(batchId),
      batchManager.listBatchItems(batchId),
    ])

    setBatch(nextBatch)
    setItems(nextItems)
    await refreshExecutionProgress(batchId)
  }, [batchId, refreshExecutionProgress])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBatch()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadBatch])

  useEffect(() => {
    const unsubscribers = [
      eventBus.subscribe('payout.updated', ({ batchId: changedBatchId }) => {
        if (changedBatchId === batchId) {
          void loadBatch()
        }
      }),
      eventBus.subscribe('batch.progress', ({ batchId: changedBatchId }) => {
        if (changedBatchId === batchId) {
          void loadBatch()
        }
      }),
      eventBus.subscribe('batch.completed', ({ batchId: changedBatchId }) => {
        if (changedBatchId === batchId) {
          void loadBatch()
        }
      }),
      eventBus.subscribe('batch.paused', ({ batchId: changedBatchId }) => {
        if (changedBatchId === batchId) {
          void loadBatch()
        }
      }),
    ]

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [batchId, loadBatch])

  const progress = useMemo(() => {
    if (execution.activeBatchId === activeBatchId) {
      return execution.progress
    }

    return items.reduce(
      (result, item) => {
        result.total += 1
        if (item.status === 'Pending') {
          result.pending += 1
        } else if (item.status === 'Signing') {
          result.signing += 1
        } else if (item.status === 'Broadcast') {
          result.broadcast += 1
        } else if (item.status === 'Confirming') {
          result.confirming += 1
        } else if (item.status === 'Success') {
          result.success += 1
          result.terminal += 1
        } else if (item.status === 'Failed') {
          result.failed += 1
          result.terminal += 1
        }
        return result
      },
      {
        total: 0,
        pending: 0,
        signing: 0,
        broadcast: 0,
        confirming: 0,
        success: 0,
        failed: 0,
        terminal: 0,
      },
    )
  }, [activeBatchId, execution.activeBatchId, execution.progress, items])

  const failedItems = items.filter((item) => item.status === 'Failed')
  const completedPercent =
    progress.total === 0 ? 0 : Math.round((progress.terminal / progress.total) * 100)
  const canStart =
    Boolean(batch) &&
    batch?.lifecycle === 'Validated' &&
    wallet.connected &&
    !execution.isRunning
  const canPause =
    Boolean(batch) &&
    batch?.lifecycle === 'Paying' &&
    execution.activeBatchId === batch?.id &&
    execution.isRunning
  const canResume =
    Boolean(batch) &&
    batch?.lifecycle === 'Paying' &&
    execution.activeBatchId === batch?.id &&
    execution.isPaused

  if (!batch) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-slate-300">
        Batch not found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={`Batch ${batch.name}`}
        description="Lifecycle overview, execution readiness, and payout state progression."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startBatch(batch.id)}
              disabled={!canStart}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start payout
            </button>
            <button
              type="button"
              onClick={() => void pauseBatch()}
              disabled={!canPause}
              className="rounded-full border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() => void resumeBatch()}
              disabled={!canResume}
              className="rounded-full border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Resume
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-6">
          <Summary label="Lifecycle" value={<StatusBadge status={batch.lifecycle} />} />
          <Summary label="Sender" value={maskAddress(batch.senderAddress)} />
          <Summary label="Rows" value={String(batch.totalCount)} />
          <Summary label="Amount" value={`${batch.totalAmount} USDT`} />
          <Summary label="Concurrency" value={`${settings.concurrency}`} />
          <Summary label="Status" value={batch.status} />
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <StatusCount label="Pending" value={progress.pending} />
            <StatusCount label="Signing" value={progress.signing} />
            <StatusCount label="Broadcast" value={progress.broadcast} />
            <StatusCount label="Confirming" value={progress.confirming} />
            <StatusCount label="Success" value={progress.success} />
            <StatusCount label="Failed" value={progress.failed} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Progress</span>
              <span>
                {progress.terminal}/{progress.total} completed
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${completedPercent}%` }}
              />
            </div>
          </div>

          {!wallet.connected ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Connect TronLink before starting this batch.
            </div>
          ) : null}

          {batch.status.toLowerCase().includes('insufficient') ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {batch.status}. Add funds in TronLink, then resume the batch.
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Failed items"
        description="Select failed rows, reset them to Pending, and re-queue only those items."
        action={
          <button
            type="button"
            onClick={() => void retryFailed(batch.id, selectedFailedIds)}
            disabled={selectedFailedIds.length === 0}
            className="rounded-full border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Retry selected
          </button>
        }
      >
        {failedItems.length === 0 ? (
          <p className="text-sm text-slate-400">No failed items yet.</p>
        ) : (
          <div className="space-y-3">
            {failedItems.map((item) => {
              const isChecked = selectedFailedIds.includes(item.id)

              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(event) =>
                      setSelectedFailedIds((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((value) => value !== item.id),
                      )
                    }
                    className="mt-1 accent-emerald-400"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold text-white">
                        {maskAddress(item.recipient)}
                      </span>
                      <StatusBadge status={item.status} />
                      <span className="text-sm text-slate-300">{item.amount} USDT</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {item.errorCode ?? 'UNKNOWN'} — {item.errorMessage ?? 'No details'}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Payout items"
        description="Live item records aligned to the Pending → Signing → Broadcast → Confirming → Success/Failed state machine."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                {['Recipient', 'Amount', 'Status', 'Error', 'TxID', 'Updated'].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-3 font-medium tracking-wide text-slate-300"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/60">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-slate-200">
                    {maskAddress(item.recipient)}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{item.amount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {item.errorCode ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {item.txId ? `${item.txId.slice(0, 10)}...` : 'Pending'}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{item.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

function StatusCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200">
      {label}: {value}
    </div>
  )
}

function Summary({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-3 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}