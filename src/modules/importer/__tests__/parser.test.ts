import { describe, expect, it } from 'vitest'
import { ImporterService } from '../index'

function makeFile(name: string, text: string) {
  return new File([text], name, { type: 'text/csv' })
}

describe('ImporterService.parseFile', () => {
  const service = new ImporterService()

  it('parses CSV with standard headers', async () => {
    const file = makeFile('batch.csv', 'address,amount,recipient_name\nTLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a,1,Alice')
    const result = await service.parseFile(file)

    expect(result.columnMap.address).toBe('address')
    expect(result.columnMap.amount).toBe('amount')
    expect(result.rows).toHaveLength(1)
  })

  it('parses CSV with Chinese headers', async () => {
    const file = makeFile('batch.csv', '地址,金额,收款人\nTLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a,1,张三')
    const result = await service.parseFile(file)

    expect(result.columnMap.address).toBe('地址')
    expect(result.columnMap.amount).toBe('金额')
    expect(result.columnMap.recipientName).toBe('收款人')
  })

  it('handles BOM in CSV', async () => {
    const file = makeFile('batch.csv', '\uFEFFaddress,amount,recipient_name\nTLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a,1,Alice')
    const result = await service.parseFile(file)

    expect(result.rows[0].address).toBe('TLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a')
  })

  it('handles quoted fields with commas', async () => {
    const file = makeFile('batch.csv', 'address,amount,recipient_name\nTLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a,1,\"Alice, Finance\"')
    const result = await service.parseFile(file)

    expect(result.rows[0].recipientName).toBe('Alice, Finance')
  })

  it('auto-detects column aliases', async () => {
    const file = makeFile('batch.csv', 'wallet,usdt,name\nTLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a,1,Alice')
    const result = await service.parseFile(file)

    expect(result.columnMap.address).toBe('wallet')
    expect(result.columnMap.amount).toBe('usdt')
    expect(result.columnMap.recipientName).toBe('name')
  })

  it('rejects an empty file', async () => {
    const file = makeFile('batch.csv', '')
    await expect(service.parseFile(file)).rejects.toThrow('Import file is empty')
  })
})