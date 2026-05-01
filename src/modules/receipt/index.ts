import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type {
  IReceiptRenderer,
  ReceiptChecksumInput,
  ReceiptRenderInput,
} from '../../types'

export class ReceiptRendererService implements IReceiptRenderer {
  async render(input: ReceiptRenderInput) {
    const element = document.createElement('div')
    element.style.position = 'fixed'
    element.style.left = '-9999px'
    element.style.top = '0'
    element.style.width = '680px'
    element.style.padding = '24px'
    element.style.color = '#0f172a'
    element.style.background = '#ffffff'
    element.innerHTML = `
      <div style="font-family: Inter, sans-serif;">
        <h1 style="margin: 0 0 12px; font-size: 22px;">TRC-20 USDT Receipt</h1>
        <p style="margin: 0 0 8px;">Batch ID: ${input.batchId}</p>
        <p style="margin: 0 0 8px;">Sender: ${input.sender}</p>
        <p style="margin: 0 0 8px;">Recipient: ${input.maskedRecipient}</p>
        <p style="margin: 0 0 8px;">Amount: ${input.amount} USDT TRC-20</p>
        <p style="margin: 0 0 8px;">TxID: ${input.txId}</p>
        <p style="margin: 0;">Status: Success</p>
      </div>
    `

    document.body.appendChild(element)

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
    })
    const pngDataUrl = canvas.toDataURL('image/png')

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    })
    pdf.addImage(pngDataUrl, 'PNG', 0, 0, canvas.width, canvas.height)
    const pdfDataUrl = pdf.output('datauristring')

    document.body.removeChild(element)

    return { pngDataUrl, pdfDataUrl }
  }

  async generateChecksum(input: ReceiptChecksumInput) {
    const encoded = new TextEncoder().encode(JSON.stringify(input))
    const hash = await crypto.subtle.digest('SHA-256', encoded)

    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
}

export const receiptRenderer = new ReceiptRendererService()