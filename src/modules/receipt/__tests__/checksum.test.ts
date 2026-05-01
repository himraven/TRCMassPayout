import { describe, expect, it } from 'vitest'
import { buildReceiptChecksumSource, ReceiptRendererService } from '../index'

const input = {
  batchId: 'batch-1',
  batchName: 'Batch 1',
  sender: 'Sender',
  recipientName: 'Alice',
  recipientAddress: 'TLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a',
  maskedRecipientAddress: 'TLrMR****vm7a',
  amount: '1.000000',
  txId: 'abcd1234',
  initiatedAt: '2026-05-02T00:00:00.000Z',
  confirmedAt: '2026-05-02T00:01:00.000Z',
  network: 'Nile',
  companyName: 'TRC Mass Payout',
}

describe('receipt checksum', () => {
  it('is deterministic', async () => {
    const service = new ReceiptRendererService()
    const first = await service.generateChecksum(input)
    const second = await service.generateChecksum(input)
    expect(first).toBe(second)
  })

  it('uses batchId + txId + amount + recipientAddress as input', () => {
    expect(buildReceiptChecksumSource(input)).toBe('batch-1abcd12341.000000TLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a')
  })

  it('returns a 64-char hex checksum', async () => {
    const service = new ReceiptRendererService()
    const checksum = await service.generateChecksum(input)
    expect(checksum).toMatch(/^[a-f0-9]{64}$/)
  })
})