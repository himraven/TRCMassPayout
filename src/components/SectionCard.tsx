import type { PropsWithChildren, ReactNode } from 'react'

export function SectionCard({
  title,
  description,
  action,
  children,
}: PropsWithChildren<{
  title: string
  description: string
  action?: ReactNode
}>) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-glow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}