import { describe, expect, it } from 'vitest'
import { validateImportedBatch } from '../validator'
import type { ImportedBatchDraft, WalletBalance } from '../../../types'

const walletBalance: WalletBalance = {
  trxBalanceSun: '100000000',
  usdtBalance: '1000',
  energyAvailable: 1000000,
  bandwidthAvailable: 1000000,
}

function buildDraft(rows: ImportedBatchDraft['rows']): ImportedBatchDraft {
  return {
    fileName: 'batch.csv',
    fileType: 'csv',
    columnMap: {
      recipientName: 'recipient_name',
      address: 'address',
      amount: 'amount',
      contactEmail: null,
      contactTelegram: null,
    },
    rows,
  }
}

describe('validateImportedBatch', () => {
  it('accepts a valid TRC-20 address', async () => {
    const result = await validateImportedBatch(
      buildDraft([
        {
          lineNumber: 2,
          recipientName: 'Alice',
          address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          amount: '100.123456',
          raw: {},
        },
      ]),
      walletBalance,
    )

    expect(result.errorCount).toBe(0)
    expect(result.validCount).toBe(1)
  })

  it('rejects bad prefix, length, and checksum', async () => {
    const result = await validateImportedBatch(
      buildDraft([
        { lineNumber: 2, recipientName: 'A', address: 'XLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a', amount: '1', raw: {} },
        { lineNumber: 3, recipientName: 'B', address: 'T123', amount: '1', raw: {} },
        { lineNumber: 4, recipientName: 'C', address: 'TLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7b', amount: '1', raw: {} },
      ]),
      walletBalance,
    )

    expect(result.errorCount).toBe(3)
    expect(result.rows.every((row) => row.errors.some((error) => error.code === 'INVALID_ADDRESS'))).toBe(true)
  })

  it('validates amount rules', async () => {
    const result = await validateImportedBatch(
      buildDraft([
        { lineNumber: 2, recipientName: 'A', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', amount: '100.123456', raw: {} },
        { lineNumber: 3, recipientName: 'B', address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf', amount: '100.1234567', raw: {} },
        { lineNumber: 4, recipientName: 'C', address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf', amount: '0', raw: {} },
        { lineNumber: 5, recipientName: 'D', address: 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp', amount: '-1', raw: {} },
        { lineNumber: 6, recipientName: 'E', address: 'TJQeZT6kqAuTL9QxK5rRrQqvGjufH6G6wK', amount: '1e3', raw: {} },
      ]),
      walletBalance,
    )

    expect(result.rows[0].status).toBe('valid')
    expect(result.rows[1].errors.some((error) => error.code === 'PRECISION_EXCEEDED')).toBe(true)
    expect(result.rows[2].errors.some((error) => error.message.includes('greater than zero'))).toBe(true)
    expect(result.rows[3].errors.some((error) => error.code === 'INVALID_AMOUNT')).toBe(true)
    expect(result.rows[4].errors.some((error) => error.message.includes('Scientific notation'))).toBe(true)
  })

  it('marks duplicate addresses as warnings', async () => {
    const address = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
    const result = await validateImportedBatch(
      buildDraft([
        { lineNumber: 2, recipientName: 'A', address, amount: '1', raw: {} },
        { lineNumber: 3, recipientName: 'B', address, amount: '2', raw: {} },
      ]),
      walletBalance,
    )

    expect(result.warningCount).toBe(2)
    expect(result.errorCount).toBe(0)
    expect(result.rows.every((row) => row.status === 'warning')).toBe(true)
  })

  it('flags missing address and amount', async () => {
    const result = await validateImportedBatch(
      buildDraft([
        { lineNumber: 2, recipientName: 'A', address: '', amount: '', raw: {} },
      ]),
      walletBalance,
    )

    expect(result.rows[0].errors.filter((error) => error.code === 'MISSING_FIELD')).toHaveLength(2)
    expect(result.rows[0].status).toBe('error')
  })

  it('sums budget and flags balance exceeded', async () => {
    const result = await validateImportedBatch(
      buildDraft([
        { lineNumber: 2, recipientName: 'A', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', amount: '400', raw: {} },
        { lineNumber: 3, recipientName: 'B', address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf', amount: '700', raw: {} },
      ]),
      {
        ...walletBalance,
        usdtBalance: '1000',
      },
    )

    expect(result.totalAmount).toBe('1100.000000')
    expect(result.errors.some((error) => error.code === 'BUDGET_EXCEEDED')).toBe(true)
  })

  it('validates 500-row batches', async () => {
    const addresses = [
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
      'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp',
      'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
    ]
    const rows = Array.from({ length: 500 }, (_, index) => ({
      lineNumber: index + 2,
      recipientName: `Recipient ${index + 1}`,
      address: addresses[index % addresses.length],
      amount: `${(index % 10) + 1}`,
      raw: {},
    }))
    const result = await validateImportedBatch(buildDraft(rows), {
      ...walletBalance,
      usdtBalance: '50000',
      trxBalanceSun: '10000000000',
    })

    expect(result.totalRows).toBe(500)
    expect(result.errorCount).toBe(0)
    expect(result.warningCount).toBe(500)
  })
})