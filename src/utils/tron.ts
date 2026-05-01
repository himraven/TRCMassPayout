import type { ImportValidationError } from '../types'

export function maskAddress(address: string) {
  if (address.length < 10) {
    return address
  }

  return `${address.slice(0, 6)}****${address.slice(-4)}`
}

export function createExplorerUrl(txId: string) {
  return `https://tronscan.org/#/transaction/${txId}`
}

export function looksLikeTronAddress(address: string) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
}

export function isUsdtPrecisionValid(amount: string) {
  const normalized = amount.trim()

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return false
  }

  const [whole, fraction = ''] = normalized.split('.')

  return Number(whole) > 0 && fraction.length <= 6
}

export function buildValidationError(
  lineNumber: number,
  code: string,
  message?: string,
): ImportValidationError {
  return {
    lineNumber,
    code,
    message: message ?? code,
  }
}