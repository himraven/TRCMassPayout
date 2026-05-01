import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionCard } from './SectionCard'
import { importerService } from '../modules/importer'
import { batchManager } from '../modules/batch'
import { useWallet } from '../hooks/useWallet'
import { useAppStore } from '../stores/useAppStore'
import { maskAddress, TRON_MAINNET_USDT_CONTRACT } from '../utils/tron'
import type { BatchRecord, ImportedBatchDraft, PayoutItemRecord, ValidationResult } from '../types'

type FilterMode = 'all' | 'errors' | 'warnings'

function formatIssues(messages: ValidationResult['rows'][number]['errors']) {
  return messages.map((item) => item.message).join(' · ')
}

function getRowClasses(status: ValidationResult['rows'][number]['status']) {
  if (status === 'error') {
    return 'bg-rose-500/10'
  }

  if (status === 'warning') {
    return 'bg-amber-500/10'
  }

  return 'bg-transparent'
}

function getStatusClasses(status: ValidationResult['rows'][number]['status']) {
  if (status === 'error') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  }

  if (status === 'warning') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  }

  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
}

export function ImportWizard() {
  const wallet = useWallet()
  const addBatch = useAppStore((state) => state.addBatch)
  const settings = useAppStore((state) => state.settings)
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [progressLabel, setProgressLabel] = useState('Awaiting file')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [draft, setDraft] = useState<ImportedBatchDraft | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const visibleRows = useMemo(() => {
    if (!validation) {
      return []
    }

    if (filter === 'errors') {
      return validation.rows.filter((row) => row.status === 'error')
    }

    if (filter === 'warnings') {
      return validation.rows.filter((row) => row.status === 'warning')
    }

    return validation.rows
  }, [filter, validation])

  const hasBlockingErrors = Boolean(validation && validation.errorCount > 0)

  async function handleFile(file: File) {
    setFatalError(null)
    setIsParsing(true)
    setProgressLabel('Parsing file')

    try {
      const parsedDraft = await importerService.parseFile(file)
      setDraft(parsedDraft)
      setProgressLabel('Validating rows')
      const result = await importerService.validateBatch(parsedDraft, wallet.balance)
      setValidation(result)
      setProgressLabel(`Validated ${result.totalRows} rows`)
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : 'Failed to import file')
      setDraft(null)
      setValidation(null)
      setProgressLabel('Import failed')
    } finally {
      setIsParsing(false)
    }
  }

  const batchWarnings =
    validation?.errors.filter((error) => error.field === 'batch') ?? []

  async function onFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      await handleFile(file)
    }
  }

  async function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      await handleFile(file)
    }
  }

  async function handleProceed() {
    if (!draft || !validation || hasBlockingErrors) {
      return
    }

    const now = new Date().toISOString()
    const batchId = crypto.randomUUID()
    const items: PayoutItemRecord[] = validation.rows.map((row) => ({
      id: crypto.randomUUID(),
      batchId,
      lineNumber: row.rowNumber,
      recipient: row.item.address,
      maskedRecipient: maskAddress(row.item.address),
      amount: row.item.amount,
      reference: row.item.recipientName || row.item.contactTelegram || row.item.contactEmail,
      status: 'Pending',
      errorCode: row.status === 'warning' ? row.errors[0]?.code ?? null : null,
      errorMessage: row.status === 'warning' ? formatIssues(row.errors) : null,
      txId: null,
      explorerUrl: null,
      idempotencyKey: crypto.randomUUID(),
      attemptCount: 0,
      signedAt: null,
      broadcastAt: null,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    }))

    const batch: BatchRecord = {
      id: batchId,
      name: draft.fileName.replace(/\.[^.]+$/, ''),
      sourceFileName: draft.fileName,
      lifecycle: 'Validated',
      status: validation.warningCount > 0 ? 'Validated with warnings' : 'Validated',
      network: wallet.network,
      senderAddress: wallet.address ?? 'Not connected',
      tokenSymbol: 'USDT',
      tokenContract: TRON_MAINNET_USDT_CONTRACT,
      totalCount: validation.totalRows,
      validCount: validation.validCount + validation.warningCount,
      invalidCount: validation.errorCount,
      successCount: 0,
      failedCount: 0,
      totalAmount: validation.totalAmount,
      estimatedEnergy: Math.round(Number(validation.estimatedTrxCost) * 65000),
      estimatedBandwidth: validation.totalRows * 350,
      concurrency: settings.concurrency,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    await batchManager.createBatch({ batch, items })
    addBatch(batch)
    navigate(`/batch/${batchId}`)
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Import payout file"
        description="Upload CSV or XLSX, auto-map columns, validate addresses and amounts, then persist a validated batch into IndexedDB."
      >
        <div className="space-y-4">
          <label
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={[
              'flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition',
              isDragging
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-slate-700 bg-slate-900/50 hover:border-slate-500',
            ].join(' ')}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={onFileSelect}
            />
            <div className="space-y-3">
              <p className="text-lg font-semibold text-white">
                Drag and drop CSV/XLSX here
              </p>
              <p className="text-sm text-slate-400">
                Supports flexible headers like wallet, addr, 地址, amount, email, telegram.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200"
              >
                Select file
              </button>
            </div>
          </label>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-300">Progress</span>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">
                  {progressLabel}
                </span>
                {draft ? (
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
                    {draft.fileType.toUpperCase()}
                  </span>
                ) : null}
              </div>
              {draft ? (
                <div className="mt-3 text-sm text-slate-400">
                  Column mapping: name <span className="text-slate-200">{draft.columnMap.recipientName ?? 'not found'}</span>,
                  address <span className="text-slate-200">{draft.columnMap.address ?? 'not found'}</span>,
                  amount <span className="text-slate-200">{draft.columnMap.amount ?? 'not found'}</span>
                </div>
              ) : null}
              {fatalError ? <p className="mt-3 text-sm text-rose-300">{fatalError}</p> : null}
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200"
              >
                Fix & Re-upload
              </button>
              <button
                type="button"
                onClick={handleProceed}
                disabled={!validation || hasBlockingErrors || isParsing}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {validation ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Rows" value={String(validation.totalRows)} />
            <SummaryCard label="Valid" value={String(validation.validCount)} tone="success" />
            <SummaryCard label="Warnings" value={String(validation.warningCount)} tone="warning" />
            <SummaryCard label="Errors" value={String(validation.errorCount)} tone="error" />
            <SummaryCard
              label="USDT / TRX est."
              value={`${validation.totalAmount} / ${validation.estimatedTrxCost}`}
            />
          </div>

          {batchWarnings.length > 0 ? (
            <div className="space-y-2">
              {batchWarnings.map((warning, index) => (
                <div
                  key={`${warning.code}-${index}`}
                  className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                >
                  {warning.message}
                </div>
              ))}
            </div>
          ) : null}

          <SectionCard
            title="Validation results"
            description="Each row shows exact issues by field so payout files can be corrected quickly."
            action={
              <div className="flex flex-wrap gap-2">
                {(['all', 'errors', 'warnings'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilter(mode)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]',
                      filter === mode
                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                        : 'border-slate-700 text-slate-300',
                    ].join(' ')}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            }
          >
            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-900/80">
                  <tr>
                    {['Row', 'Status', 'Recipient', 'Address', 'Amount', 'Email', 'Telegram', 'Issues'].map((head) => (
                      <th key={head} className="px-4 py-3 font-medium tracking-wide text-slate-300">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                  {visibleRows.map((row) => (
                    <tr key={row.rowNumber} className={getRowClasses(row.status)}>
                      <td className="px-4 py-3 text-slate-200">{row.rowNumber}</td>
                      <td className="px-4 py-3">
                        <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase', getStatusClasses(row.status)].join(' ')}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{row.item.recipientName || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{row.item.address || '—'}</td>
                      <td className="px-4 py-3 text-slate-200">{row.item.amount || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{row.item.contactEmail || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{row.item.contactTelegram || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.errors.length > 0 ? (
                          <ul className="space-y-1">
                            {row.errors.map((error, index) => (
                              <li key={`${error.code}-${index}`}>
                                <span className="font-semibold text-slate-100">{error.field}</span>: {error.message}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          'No issues'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : null}

      {isParsing ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          Parsing and validating in chunks to keep the UI responsive.
        </div>
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning' | 'error'
}) {
  const toneClasses = {
    default: 'border-slate-800 bg-slate-900/60 text-white',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
    error: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
  }

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  )
}