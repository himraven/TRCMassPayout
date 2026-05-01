import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Settings', to: '/settings' },
]

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Mode B · Self-custody
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  TRC-20 USDT Batch Payout
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
                  Browser-native TRON Mainnet payout orchestration with
                  TronLink signing, Dexie-backed recovery, receipt generation,
                  and export-ready audit artifacts.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:grid-cols-3">
              <Stat label="Wallet mode" value="TronLink only" />
              <Stat label="Batch scale" value="100-1000+" />
              <Stat label="Receipt coverage" value="100% target" />
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded-full border px-4 py-2 text-sm font-medium transition',
                    isActive
                      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}