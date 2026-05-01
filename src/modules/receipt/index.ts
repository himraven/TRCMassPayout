import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { db } from '../../db/schema'
import type {
  BatchRecord,
  IReceiptRenderer,
  PayoutItemRecord,
  ReceiptChecksumInput,
  ReceiptRecord,
  ReceiptRenderInput,
} from '../../types'
import { eventBus } from '../../utils/eventBus'
import { sanitizeUserText } from '../../utils/sanitize'

const RECEIPT_WIDTH = 400
const RECEIPT_HEIGHT = 700
const TRONSCAN_TX_URL = 'https://tronscan.org/#/transaction/'

function formatTimestamp(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date)
}

function escapeHtml(value: string) {
  return sanitizeUserText(value, 240)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function toBlobFromCanvas(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate PNG blob'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

function buildReceiptMarkup(input: ReceiptRenderInput, qrValue: string, checksum: string) {
  return `
    <div style="width:${RECEIPT_WIDTH}px;height:${RECEIPT_HEIGHT}px;box-sizing:border-box;padding:24px;background:#f8fafc;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
      <div style="height:100%;border:1px solid #dbe4ee;border-radius:24px;background:#ffffff;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
        <div style="padding:24px;background:linear-gradient(135deg,#16a34a,#22c55e);color:#f0fdf4;">
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.18);font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Payment Successful
          </div>
          <div style="margin-top:18px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:22px;font-weight:800;line-height:1.2;">${escapeHtml(input.companyName || 'TRC Mass Payout')}</div>
              <div style="margin-top:6px;font-size:12px;opacity:0.9;">Batch ID: ${escapeHtml(input.batchId)}</div>
            </div>
            <div style="width:54px;height:54px;border-radius:16px;border:1px dashed rgba(255,255,255,0.55);display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;padding:6px;opacity:0.92;">
              LOGO
            </div>
          </div>
        </div>
        <div style="padding:22px;">
          <div style="border:1px solid #e2e8f0;border-radius:20px;background:#f8fafc;padding:18px;">
            <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Amount</div>
            <div style="margin-top:8px;font-size:30px;font-weight:800;color:#0f172a;line-height:1.1;">${escapeHtml(input.amount)} USDT</div>
            <div style="margin-top:6px;font-size:14px;color:#334155;">(TRC-20)</div>
            <div style="margin-top:18px;display:grid;grid-template-columns:1fr;gap:12px;">
              ${[
                ['Network', input.network],
                ['Recipient name', input.recipientName],
                ['Recipient address', input.maskedRecipientAddress],
                ['Sender', input.sender],
                ['Transaction Hash', input.txId],
                ['Initiated at', formatTimestamp(input.initiatedAt)],
                ['Confirmed at', formatTimestamp(input.confirmedAt)],
                ['Status', 'Success'],
              ]
                .map(
                  ([label, value]) => `
                    <div style="display:flex;flex-direction:column;gap:5px;">
                      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</div>
                      <div style="font-size:${label === 'Transaction Hash' ? '13px' : '15px'};font-family:${label === 'Transaction Hash' ? 'ui-monospace,SFMono-Regular,Menlo,monospace' : 'inherit'};word-break:break-word;color:#0f172a;">
                        ${
                          label === 'Status'
                            ? '<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:700;">Success</span>'
                            : escapeHtml(value)
                        }
                      </div>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </div>
          <div style="margin-top:18px;border-top:1px solid #e2e8f0;padding-top:18px;display:grid;grid-template-columns:120px 1fr;gap:16px;align-items:start;">
            <div style="border:1px solid #e2e8f0;border-radius:18px;padding:10px;background:#ffffff;">
              <img src="${qrValue}" alt="Transaction QR code" style="width:100px;height:100px;display:block;margin:0 auto;" />
            </div>
            <div>
              <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">SHA-256 checksum</div>
              <div style="margin-top:8px;font-size:12px;line-height:1.6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;word-break:break-all;">${checksum}</div>
              <div style="margin-top:12px;font-size:12px;color:#475569;">Verify this transaction on TRON blockchain</div>
              <div style="margin-top:4px;font-size:11px;color:#64748b;word-break:break-all;">${escapeHtml(
                `${TRONSCAN_TX_URL}${input.txId}`,
              )}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

export function buildReceiptChecksumSource(input: ReceiptChecksumInput) {
  return `${input.batchId}${input.txId}${input.amount}${input.recipientAddress}`
}

export class ReceiptRendererService implements IReceiptRenderer {
  constructor() {
    this.bootstrapSubscriptions()
  }

  async render(input: ReceiptRenderInput) {
    const checksumSha256 = await this.generateChecksum(input)
    const qrValue = await QRCode.toDataURL(`${TRONSCAN_TX_URL}${input.txId}`, {
      width: 160,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
    const element = document.createElement('div')
    element.setAttribute('data-receipt-renderer', input.txId)
    element.style.position = 'fixed'
    element.style.left = '-9999px'
    element.style.top = '0'
    element.style.width = `${RECEIPT_WIDTH}px`
    element.style.height = `${RECEIPT_HEIGHT}px`
    element.style.pointerEvents = 'none'
    element.style.opacity = '0'
    element.innerHTML = buildReceiptMarkup(input, qrValue, checksumSha256)
    document.body.appendChild(element)

    try {
      const canvas = await html2canvas(element.firstElementChild as HTMLElement, {
        backgroundColor: '#f8fafc',
        scale: 2,
        useCORS: true,
        width: RECEIPT_WIDTH,
        height: RECEIPT_HEIGHT,
      })
      const pngBlob = await toBlobFromCanvas(canvas)
      const pngDataUrl = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const renderWidth = 300
      const renderHeight = (RECEIPT_HEIGHT / RECEIPT_WIDTH) * renderWidth
      const x = (pageWidth - renderWidth) / 2
      const y = (pageHeight - renderHeight) / 2
      pdf.addImage(pngDataUrl, 'PNG', x, y, renderWidth, renderHeight)
      const pdfBlob = pdf.output('blob')

      return { pngBlob, pdfBlob, checksumSha256, qrValue }
    } finally {
      document.body.removeChild(element)
    }
  }

  async generateChecksum(input: ReceiptChecksumInput) {
    const encoded = new TextEncoder().encode(buildReceiptChecksumSource(input))
    const hash = await crypto.subtle.digest('SHA-256', encoded)

    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  async ensureReceiptForItem(payoutItemId: string) {
    const existing = await this.getReceiptByItemId(payoutItemId)
    if (existing) {
      return existing
    }

    const item = await db.payoutItems.get(payoutItemId)
    if (!item || item.status !== 'Success' || !item.txId || !item.confirmedAt) {
      return null
    }

    const batch = await db.batches.get(item.batchId)
    if (!batch) {
      return null
    }

    const receipt = await this.createReceiptRecord(batch, item)
    await db.receipts.put(receipt)
    eventBus.emit('receipt.generated', {
      receiptId: receipt.id,
      batchId: receipt.batchId,
      payoutItemId: receipt.payoutItemId,
    })
    return receipt
  }

  async getReceiptByItemId(payoutItemId: string) {
    return (await db.receipts.where('payoutItemId').equals(payoutItemId).first()) ?? null
  }

  async listBatchReceipts(batchId: string) {
    return db.receipts.where('batchId').equals(batchId).sortBy('generatedAt')
  }

  private bootstrapSubscriptions() {
    eventBus.subscribe('payout.success', ({ itemId }) => {
      void this.ensureReceiptForItem(itemId)
    })
    eventBus.subscribe('payout.updated', ({ itemId, status }) => {
      if (status === 'Success') {
        void this.ensureReceiptForItem(itemId)
      }
    })
    eventBus.subscribe('payout.confirmed', ({ itemId, status }) => {
      if (status === 'Success') {
        void this.ensureReceiptForItem(itemId)
      }
    })
  }

  private async createReceiptRecord(batch: BatchRecord, item: PayoutItemRecord) {
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const initiatedAt = item.broadcastAt ?? item.signedAt ?? item.createdAt
    const companyName = localStorage.getItem('trc-mass-payout-settings')
    const parsedStore = companyName ? JSON.parse(companyName) : null
    const senderIdentity =
      sanitizeUserText(parsedStore?.state?.settings?.senderIdentity || 'TRC Mass Payout', 80)
    const renderInput: ReceiptRenderInput = {
      batchId: batch.id,
      batchName: batch.name,
      sender: senderIdentity,
      recipientName: item.reference?.trim() || 'Unknown recipient',
      recipientAddress: item.recipient,
      maskedRecipientAddress: item.maskedRecipient,
      amount: item.amount,
      txId: item.txId as string,
      initiatedAt,
      confirmedAt: item.confirmedAt as string,
      network: batch.network || 'TRON Mainnet',
      companyName: senderIdentity,
    }
    const rendered = await this.render(renderInput)
    const generatedAt = new Date().toISOString()

    return {
      id: crypto.randomUUID(),
      batchId: batch.id,
      payoutItemId: item.id,
      txId: item.txId as string,
      batchName: batch.name,
      sender: senderIdentity,
      recipientName: renderInput.recipientName,
      recipientAddress: item.recipient,
      maskedRecipientAddress: item.maskedRecipient,
      amount: item.amount,
      network: renderInput.network,
      status: 'Success',
      checksumSha256: rendered.checksumSha256,
      pngBlob: rendered.pngBlob,
      pdfBlob: rendered.pdfBlob,
      qrValue: rendered.qrValue,
      initiatedAt,
      confirmedAt: item.confirmedAt as string,
      generatedAt,
      timezone,
    } satisfies ReceiptRecord
  }
}

export const receiptRenderer = new ReceiptRendererService()