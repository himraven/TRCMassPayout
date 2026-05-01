import { Link } from 'react-router-dom'
import { MetricCard } from '../components/MetricCard'
import { SectionCard } from '../components/SectionCard'
import { StatusBadge } from '../components/StatusBadge'
import { useBatches } from '../hooks/useBatches'
import { useWallet } from '../hooks/useWallet'
import { sampleValidationRules } from '../stores/mockData'

export function Dashboard() {
  const { batches, activeCount, completedCount } = useBatches()
  const wallet = useWallet()

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Connected wallet"
          value={wallet.connected ? 'Ready' : 'Disconnected'}
          hint={wallet.address ?? 'Connect TronLink to start payouts'}
          icon="🔐"
        />
        <MetricCard
          label="USDT balance"
          value={`${wallet.balance.usdtBalance} USDT`}
          hint="Budget checks block over-allocated batches before signing."
          icon="💸"
        />
        <MetricCard
          label="Paying batches"
          value={String(activeCount)}
          hint="Resumable queue state is checkpointed in IndexedDB."
          icon="⚙️"
        />
        <MetricCard
          label="Completed batches"
          value={String(completedCount)}
          hint="Each success item requires PNG and PDF receipt coverage."
          icon="🧾"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <SectionCard
          title="Wallet readiness"
          description="TronLink connection, balance visibility, deposit QR readiness, and operational energy estimation for TRON Mainnet USDT transfers."
          action={
            <button className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200">
              Connect TronLink
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Readiness label="Address" value={wallet.address ?? 'Not connected'} />
            <Readiness label="Network" value="TRON Mainnet" />
            <Readiness label="TRX balance" value={wallet.balance.trxBalanceSun} />
            <Readiness label="Energy estimate" value={`${wallet.balance.energyAvailable}`} />
          </div>
        </SectionCard>

        <SectionCard
          title="Import validation coverage"
          description="CSV/XLSX validation must intercept invalid addresses, duplicate rows, precision issues, and insufficient budget before any signing request occurs."
        >
          <ul className="space-y-3">
            {sampleValidationRules.map((rule) => (
              <li
                key={rule.label}
                className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{rule.label}</p>
                  <p className="mt-1 text-sm text-slate-400">{rule.description}</p>
                </div>
                <StatusBadge status={rule.state} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Recent batches"
        description="Draft → Validated → Paying → Completed lifecycle with queue metrics aligned to the payout item state machine."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                {['Batch', 'Lifecycle', 'Rows', 'Amount', 'Receipts', 'Action'].map(
                  (head) => (
                    <th
                      key={head}
                      className="px-4 py-3 font-medium tracking-wide text-slate-300"
                    >
                      {head}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/60">
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="px-4 py-3 text-white">
                    <div className="font-medium">{batch.name}</div>
                    <div className="text-xs text-slate-400">{batch.sourceFileName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={batch.lifecycle} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">{batch.totalCount}</td>
                  <td className="px-4 py-3 text-slate-300">{batch.totalAmount} USDT</td>
                  <td className="px-4 py-3 text-slate-300">{batch.successCount}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/batch/${batch.id}`}
                      className="inline-flex rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                    >
                      Open batch
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

function Readiness({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}