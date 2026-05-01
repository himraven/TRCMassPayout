import { useState } from 'react'

const DISCLAIMER_KEY = 'trc-mass-payout-disclaimer-accepted'

export function DisclaimerModal() {
  const [accepted, setAccepted] = useState(
    () => window.localStorage.getItem(DISCLAIMER_KEY) === 'true',
  )

  if (accepted) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
          First-launch disclosure
        </span>
        <h2 className="mt-4 text-2xl font-semibold text-white">Review before using the app</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-300">
          <li className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            This is a non-custodial batch payout tool that relies on your connected TronLink wallet.
          </li>
          <li className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            You assume full responsibility for reviewing recipients, balances, and every fund transfer.
          </li>
          <li className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            The app does not store private keys and cannot recover funds sent to incorrect addresses.
          </li>
        </ul>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISCLAIMER_KEY, 'true')
            setAccepted(true)
          }}
          className="mt-6 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200"
        >
          I understand and accept
        </button>
      </div>
    </div>
  )
}