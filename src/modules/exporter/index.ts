import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import { db } from '../../db/schema'
import type { IExporter } from '../../types'
import { receiptRenderer } from '../receipt'
import { eventBus } from '../../utils/eventBus'

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function sanitizeFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .replaceAll('\u0000', '_')
    .replace(/\s+/g, '_')
    .slice(0, 64)
}

function maskAddress(address: string) {
  if (address.length <= 10) {
    return address
  }
  return `${address.slice(0, 6)}***${address.slice(-4)}`
}

export class ExporterService implements IExporter {
  async exportZip(batchId: string) {
    const batch = await db.batches.get(batchId)
    const items = await db.payoutItems.where('batchId').equals(batchId).sortBy('lineNumber')
    await Promise.all(
      items
        .filter((item) => item.status === 'Success')
        .map((item) => receiptRenderer.ensureReceiptForItem(item.id)),
    )
    const receipts = await receiptRenderer.listBatchReceipts(batchId)
    const zip = new JSZip()
    const receiptsFolder = zip.folder('receipts')

    receipts.forEach((receipt) => {
      const filename = `${sanitizeFileNamePart(receipt.recipientName || 'recipient')}_${maskAddress(
        receipt.recipientAddress,
      )}_${receipt.txId.slice(0, 8)}.png`
      receiptsFolder?.file(filename, receipt.pngBlob)
    })

    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          batchId,
          batchName: batch?.name ?? batchId,
          exportedAt: new Date().toISOString(),
          totalReceipts: receipts.length,
          receipts: receipts.map((receipt) => ({
            receiptId: receipt.id,
            payoutItemId: receipt.payoutItemId,
            recipientName: receipt.recipientName,
            recipientAddress: receipt.recipientAddress,
            amount: receipt.amount,
            txId: receipt.txId,
            checksumSha256: receipt.checksumSha256,
            generatedAt: receipt.generatedAt,
          })),
        },
        null,
        2,
      ),
    )

    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, `${sanitizeFileNamePart(batch?.name ?? batchId)}_receipts.zip`)
    eventBus.emit('export.completed', { batchId, format: 'zip' })
    return blob
  }

  async exportCSV(batchId: string) {
    const items = await db.payoutItems.where('batchId').equals(batchId).sortBy('lineNumber')
    const rows = await Promise.all(
      items.map(async (item, index) => {
        const receipt =
          item.status === 'Success'
            ? await receiptRenderer.ensureReceiptForItem(item.id)
            : await receiptRenderer.getReceiptByItemId(item.id)

        return [
          String(index + 1),
          item.reference ?? '',
          item.recipient,
          item.amount,
          'USDT',
          item.txId ?? '',
          item.status,
          item.errorCode ?? '',
          item.broadcastAt ?? item.signedAt ?? item.createdAt,
          item.confirmedAt ?? '',
          receipt?.checksumSha256 ?? '',
        ]
      }),
    )
    const csv = [
      [
        'Row',
        'RecipientName',
        'Address',
        'Amount',
        'Currency',
        'TxID',
        'Status',
        'ErrorCode',
        'InitiatedAt',
        'ConfirmedAt',
        'Checksum',
      ].join(','),
      ...rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8',
    })
    downloadBlob(blob, `${batchId}_reconciliation.csv`)
    eventBus.emit('export.completed', { batchId, format: 'csv' })
    return blob
  }

  async exportPdfBundle(batchId: string) {
    const items = await db.payoutItems.where('batchId').equals(batchId).sortBy('lineNumber')
    await Promise.all(
      items
        .filter((item) => item.status === 'Success')
        .map((item) => receiptRenderer.ensureReceiptForItem(item.id)),
    )
    const receipts = await receiptRenderer.listBatchReceipts(batchId)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    })

    for (const [index, receipt] of receipts.entries()) {
      if (index > 0) {
        pdf.addPage()
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(receipt.pngBlob)
      })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const renderWidth = 300
      const renderHeight = 525
      pdf.addImage(
        dataUrl,
        'PNG',
        (pageWidth - renderWidth) / 2,
        (pageHeight - renderHeight) / 2,
        renderWidth,
        renderHeight,
      )
    }

    const blob = pdf.output('blob')
    downloadBlob(blob, `${batchId}_receipts_bundle.pdf`)
    eventBus.emit('export.completed', { batchId, format: 'pdf-bundle' })
    return blob
  }
}

export const exporterService = new ExporterService()