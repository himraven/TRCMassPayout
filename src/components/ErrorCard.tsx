import type { ReactNode } from 'react'

type ErrorCardProps = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}

export function ErrorCard({
  title,
  description,
  actionLabel,
  onAction,
  icon = '⚠️',
}: ErrorCardProps) {
  return (
    <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-100 shadow-glow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="text-xl">{icon}</div>
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-rose-100/90">{description}</p>
          </div>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-full border border-rose-200/20 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-white"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}