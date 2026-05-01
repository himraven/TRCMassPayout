import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { ReceiptRecord } from '../types'

type ReceiptPreviewProps = {
  receipt: ReceiptRecord | null
  onClose: () => void
}

function createObjectUrl(blob: Blob | null) {
  if (!blob) {
    return null
  }
  return URL.createObjectURL(blob)
}

export function ReceiptPreview({ receipt, onClose }: ReceiptPreviewProps) {
  const pngUrl = useMemo(
    () => (receipt ? createObjectUrl(receipt.pngBlob) : null),
    [receipt],
  )
  const pdfUrl = useMemo(
    () => (receipt ? createObjectUrl(receipt.pdfBlob) : null),
    [receipt],
  )

  useEffect(() => {
    return () => {
      if (pngUrl) {
        URL.revokeObjectURL(pngUrl)
      }
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl, pngUrl])

  if (!receipt) {
    return null
  }

  const download = (url: string | null, fileName: string) => {
    if (!url) {
      return
    }
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
  }

  const handlePrint = () => {
    if (!pngUrl) {
      return
    }
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=860,height=900')
    if (!printWindow) {
      return
    }
    printWindow.document.write(
      `<html><body style="margin:0;padding:24px;background:#f8fafc;display:flex;justify-content:center;"><img src="${pngUrl}" style="max-width:100%;height:auto;" /></body></html>`,
    )
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="max-h-[95vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{receipt.recipientName}</h3>
            <p className="text-sm text-slate-400">{receipt.txId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                download(pngUrl, `${receipt.recipientName}_${receipt.txId.slice(0, 8)}.png`)
              }
              className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={() =>
                download(pdfUrl, `${receipt.recipientName}_${receipt.txId.slice(0, 8)}.pdf`)
              }
              className="rounded-full border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-full border border-violet-500/30 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-200"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              Close
            </button>
          </div>
        </div>
        <div className="grid gap-0 lg:grid-cols-[420px_1fr]">
          <div className="border-r border-slate-800 bg-slate-900/60 p-4">
            {pngUrl ? (
              <img
                src={pngUrl}
                alt={`Receipt for ${receipt.recipientName}`}
                className="mx-auto rounded-2xl border border-slate-800 bg-white"
              />
            ) : null}
          </div>
          <div className="space-y-4 p-6 text-sm text-slate-300">
            <Detail label="Batch">{receipt.batchName}</Detail>
            <Detail label="Recipient address">{receipt.recipientAddress}</Detail>
            <Detail label="Amount">{receipt.amount} USDT</Detail>
            <Detail label="Network">{receipt.network}</Detail>
            <Detail label="Checksum">{receipt.checksumSha256}</Detail>
            <Detail label="Generated at">{receipt.generatedAt}</Detail>
            <Detail label="Confirmed at">{receipt.confirmedAt}</Detail>
          </div>
        </div>
      </div>
    </div>
  )
}

function Detail({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <div className="mt-2 break-all text-slate-200">{children}</div>
    </div>
  )
}