import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { SectionCard } from '../components/SectionCard'
import { StatusBadge } from '../components/StatusBadge'
import { sampleBatches, samplePayoutItems } from '../stores/mockData'
import { maskAddress } from '../utils/tron'

export function BatchDetail() {
  const { batchId } = useParams()

  const batch = useMemo(
    () => sampleBatches.find((item) => item.id === batchId) ?? sampleBatches[0],
    [batchId],
  )

  const items = samplePayoutItems.filter((item) => item.batchId === batch.id)

  return (
    <div className="space-y-6">
      <SectionCard
        title={`Batch ${batch.name}`}
        description="Lifecycle overview, execution readiness, and payout state progression."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Summary label="Lifecycle" value={<StatusBadge status={batch.lifecycle} />} />
          <Summary label="Sender" value={maskAddress(batch.senderAddress)} />
          <Summary label="Rows" value={String(batch.totalCount)} />
          <Summary label="Amount" value={`${batch.totalAmount} USDT`} />
        </div>
      </SectionCard>

      <SectionCard
        title="Payout items"
        description="Representative item records aligned to the Pending → Signed → Broadcast → Confirming → Success/Failed state machine."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                {['Recipient', 'Amount', 'Status', 'TxID', 'Updated'].map((head) => (
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