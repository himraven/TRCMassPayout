import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { MetricCard } from '../components/MetricCard'
import { SectionCard } from '../components/SectionCard'
import { StatusBadge } from '../components/StatusBadge'
import { useBatches } from '../hooks/useBatches'
import { useWallet } from '../hooks/useWallet'
import { sampleValidationRules } from '../stores/mockData'

export function Dashboard() {
  const { batches, activeCount, completedCount } = useBatches()
  const wallet = useWallet()
  const [qrCode, setQrCode] = useState<string>('')

  useEffect(() => {
    if (!wallet.address) {
      return
    }

    let active = true

    void QRCode.toDataURL(wallet.address, {
      margin: 1,
      width: 220,
      color: {
        dark: '#e2e8f0',
        light: '#00000000',
      },
    }).then((dataUrl) => {
      if (active) {
        setQrCode(dataUrl)
      }
    })

    return () => {
      active = false
    }
  }, [wallet.address])

  const trxBalance = (Number(wallet.balance.trxBalanceSun) / 1_000_000).toFixed(6)
  const estimatedTrxCost = (
    Number(wallet.energyEstimate.estimatedTrxCostSun) / 1_000_000
  ).toFixed(3)

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Connected wallet"
          value={wallet.connected ? 'Ready' : wallet.isConnecting ? 'Connecting' : 'Disconnected'}
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
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-3 w-3 rounded-full ${
                  wallet.connected ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              <button
                type="button"
                onClick={() =>
                  wallet.connected ? void wallet.disconnect() : void wallet.connect()
                }
                className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200"
              >
                {wallet.connected ? 'Disconnect' : 'Connect TronLink'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {wallet.error ? (
              <Banner tone="rose" message={wallet.error} />
            ) : null}
            {wallet.energyEstimate.lowTrxWarning ? (
              <Banner
                tone="amber"
                message="Low TRX balance may not cover repeated USDT transfer fees."
              />
            ) : null}
            {wallet.energyEstimate.lowEnergyWarning ? (
              <Banner
                tone="amber"
                message="Available energy is below one USDT transfer estimate."
              />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Readiness label="Address" value={wallet.address ?? 'Not connected'} />
              <Readiness label="Network" value={wallet.network} />
              <Readiness label="TRX balance" value={`${trxBalance} TRX`} />
              <Readiness label="USDT balance" value={`${wallet.balance.usdtBalance} USDT`} />
              <Readiness
                label="Bandwidth available"
                value={`${wallet.balance.bandwidthAvailable}`}
              />
              <Readiness
                label="Energy available"
                value={`${wallet.balance.energyAvailable}`}
              />
              <Readiness
                label="USDT transfer energy"
                value={`${wallet.energyEstimate.energyPerTransfer}`}
              />
              <Readiness
                label="Estimated TRX cost"
                value={`${estimatedTrxCost} TRX`}
              />
              <Readiness
                label="Transfers supported"
                value={`${wallet.energyEstimate.estimatedTransfersSupported}`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Deposit address
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-white">
                  {wallet.address ?? 'Connect TronLink to generate your deposit QR.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void wallet.refreshBalances()}
                    disabled={!wallet.connected}
                    className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Refresh balances
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      wallet.address
                        ? void navigator.clipboard.writeText(wallet.address)
                        : undefined
                    }
                    disabled={!wallet.address}
                    className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy address
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Last synced: {wallet.lastSyncedAt ?? 'Not yet synced'}
                </p>
              </div>

              <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                {wallet.address && qrCode ? (
                  <img src={qrCode} alt="Wallet deposit QR code" className="h-[220px] w-[220px]" />
                ) : (
                  <p className="text-center text-sm text-slate-400">
                    QR code appears after wallet connection.
                  </p>
                )}
              </div>
            </div>
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

function Banner({ tone, message }: { tone: 'amber' | 'rose'; message: string }) {
  const toneClasses =
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : 'border-rose-500/30 bg-rose-500/10 text-rose-100'

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses}`}>{message}</div>
}