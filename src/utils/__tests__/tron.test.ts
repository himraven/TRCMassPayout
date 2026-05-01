import { describe, expect, it } from 'vitest'
import {
  amountToTokenUnits,
  isValidTronAddress,
  looksLikeTronAddress,
  maskAddress,
  trxToSun,
} from '../tron'

describe('tron utils', () => {
  const validAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

  it('masks address as first6 + stars + last4', () => {
    expect(maskAddress(validAddress)).toBe('TR7NHq****Lj6t')
  })

  it('validates tron address format and checksum', async () => {
    expect(looksLikeTronAddress(validAddress)).toBe(true)
    expect(await isValidTronAddress(validAddress)).toBe(true)
    expect(await isValidTronAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u')).toBe(false)
  })

  it('converts TRX to sun', () => {
    expect(trxToSun(1.5)).toBe(1500000)
  })

  it('scales token units by 1e6', () => {
    expect(amountToTokenUnits('100.123456')).toBe('100123456')
  })
})