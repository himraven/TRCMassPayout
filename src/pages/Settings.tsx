import { SectionCard } from '../components/SectionCard'
import { useAppStore } from '../stores/useAppStore'
import { sanitizeNumericInput, sanitizeUserText } from '../utils/sanitize'

export function Settings() {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)

  return (
    <div className="space-y-6">
      <SectionCard
        title="Execution settings"
        description="Queue concurrency, confirmation timeout, and recovery policy are stored locally to support resumable payouts."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Parallel workers
              </p>
              <span className="text-sm font-semibold text-white">
                {settings.concurrency}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={settings.concurrency}
              onChange={(event) =>
                updateSettings({
                  concurrency: sanitizeNumericInput(Number(event.target.value), {
                    min: 1,
                    max: 10,
                    fallback: 5,
                  }),
                })
              }
              className="mt-4 w-full accent-emerald-400"
            />
            <p className="mt-2 text-sm text-slate-400">
              Configurable N-parallel queue
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Fee limit (TRX)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.feeLimitTrx}
              onChange={(event) =>
                updateSettings({
                  feeLimitTrx: sanitizeNumericInput(Number(event.target.value), {
                    min: 1,
                    max: 10000,
                    fallback: 150,
                  }),
                })
              }
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            />
            <p className="mt-2 text-sm text-slate-400">
              Default fee limit for TRC-20 transfers
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Confirmation timeout (minutes)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.confirmationTimeoutMinutes}
              onChange={(event) =>
                updateSettings({
                  confirmationTimeoutMinutes: sanitizeNumericInput(
                    Number(event.target.value),
                    {
                      min: 1,
                      max: 1440,
                      fallback: 10,
                    },
                  ),
                })
              }
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            />
            <p className="mt-2 text-sm text-slate-400">
              Maps to CONFIRM_TIMEOUT
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Company / sender identity
          </label>
          <input
            type="text"
            value={settings.senderIdentity}
            onChange={(event) =>
              updateSettings({
                senderIdentity: sanitizeUserText(event.target.value, 80),
              })
            }
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            placeholder="Acme Treasury"
          />
          <p className="mt-2 text-sm text-slate-400">
            Used in receipt headers and exported documents
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Crash recovery
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Reload scan resumes in-flight items automatically
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateSettings({ resumeOnReload: !settings.resumeOnReload })
              }
              className={[
                'rounded-full border px-4 py-2 text-sm font-semibold',
                settings.resumeOnReload
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                  : 'border-slate-700 text-slate-300',
              ].join(' ')}
            >
              {settings.resumeOnReload ? 'Enabled' : 'Disabled'}
            </button>
          </label>
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