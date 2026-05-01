import { SectionCard } from '../components/SectionCard'
import { useAppStore } from '../stores/useAppStore'

export function Settings() {
  const settings = useAppStore((state) => state.settings)

  return (
    <div className="space-y-6">
      <SectionCard
        title="Execution settings"
        description="Queue concurrency, confirmation timeout, and recovery policy are stored locally to support resumable payouts."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <SettingItem
            label="Parallel workers"
            value={`${settings.concurrency}`}
            hint="Configurable N-parallel queue"
          />
          <SettingItem
            label="Confirmation timeout"
            value={`${settings.confirmationTimeoutMs / 1000}s`}
            hint="Maps to CONFIRM_TIMEOUT"
          />
          <SettingItem
            label="Crash recovery"
            value={settings.resumeOnReload ? 'Enabled' : 'Disabled'}
            hint="Reload scan resumes in-flight items"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Architecture guardrails"
        description="V1 ships in Mode B only while preserving a provider abstraction for future Mode A."
      >
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
            Private keys never leave TronLink.
          </li>
          <li className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
            Idempotency relies on UUID checkpoints plus IndexedDB status scans.
          </li>
          <li className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
            ZIP export is the only V1 delivery mechanism for receipts and summaries.
          </li>
        </ul>
      </SectionCard>
    </div>
  )
}

function SettingItem({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{hint}</p>
    </div>
  )
}