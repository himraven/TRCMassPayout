import type { BatchLifecycle, PayoutItemStatus } from '../types'

const colorMap: Record<BatchLifecycle | PayoutItemStatus, string> = {
  Draft: 'border-slate-600 bg-slate-700/20 text-slate-200',
  Validated: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  Paying: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  Completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  Pending: 'border-slate-600 bg-slate-700/20 text-slate-200',
  Signed: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  Broadcast: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  Confirming: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  Success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  Failed: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
}

export function StatusBadge({
  status,
}: {
  status: BatchLifecycle | PayoutItemStatus
}) {
  return (
    <span
      className={[
        'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
        colorMap[status],
      ].join(' ')}
    >
      {status}
    </span>
  )
}