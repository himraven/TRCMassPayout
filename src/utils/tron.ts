import type { ImportValidationError } from '../types'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_MAP = new Map(
  [...BASE58_ALPHABET].map((character, index) => [character, index]),
)
const TRON_ADDRESS_PREFIX = 0x41
const SUN_PER_TRX = 1_000_000
const DEFAULT_TRX_PER_TRANSFER = 13.5
export const TRON_MAINNET_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
export const TRON_NILE_USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
export const TRC20_TOKEN_DECIMALS = 6

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
  field: ImportValidationError['field'],
  code: ImportValidationError['code'],
  message?: string,
): ImportValidationError {
  return {
    field,
    lineNumber,
    code,
    message: message ?? code,
  }
}

export async function sha256(data: Uint8Array) {
  const view = new Uint8Array(data.byteLength)
  view.set(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', view)
  return new Uint8Array(hashBuffer)
}

export function decodeBase58(value: string) {
  let accumulator = 0n

  for (const character of value) {
    const digit = BASE58_MAP.get(character)
    if (digit === undefined) {
      return null
    }

    accumulator = accumulator * 58n + BigInt(digit)
  }

  const bytes: number[] = []
  while (accumulator > 0n) {
    bytes.unshift(Number(accumulator % 256n))
    accumulator /= 256n
  }

  for (let index = 0; index < value.length && value[index] === '1'; index += 1) {
    bytes.unshift(0)
  }

  return Uint8Array.from(bytes)
}

export async function isValidTronAddress(address: string) {
  if (!looksLikeTronAddress(address)) {
    return false
  }

  const decoded = decodeBase58(address)
  if (!decoded || decoded.length !== 25) {
    return false
  }

  const payload = decoded.slice(0, 21)
  const checksum = decoded.slice(21)

  if (payload[0] !== TRON_ADDRESS_PREFIX) {
    return false
  }

  const firstHash = await sha256(payload)
  const secondHash = await sha256(firstHash)
  const expectedChecksum = secondHash.slice(0, 4)

  return checksum.every((byte, index) => byte === expectedChecksum[index])
}

export function estimateTrxCost(rowCount: number, trxPerTransfer = DEFAULT_TRX_PER_TRANSFER) {
  return (rowCount * trxPerTransfer).toFixed(6)
}

export function formatSunToTrx(value: string) {
  return (Number(value) / SUN_PER_TRX).toFixed(6)
}

export function trxToSun(value: number) {
  return Math.round(value * SUN_PER_TRX)
}

export function amountToTokenUnits(
  amount: string,
  decimals = TRC20_TOKEN_DECIMALS,
) {
  const normalized = amount.trim()

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid token amount: ${amount}`)
  }

  const [whole, fraction = ''] = normalized.split('.')
  const paddedFraction = (fraction + '0'.repeat(decimals)).slice(0, decimals)

  return `${BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || '0')}`
}

export function decodeHexMessage(hexValue?: string | null) {
  if (!hexValue) {
    return null
  }

  const normalized = hexValue.startsWith('0x') ? hexValue.slice(2) : hexValue
  const pairs = normalized.match(/.{1,2}/g)

  if (!pairs) {
    return null
  }

  try {
    const bytes = Uint8Array.from(pairs.map((pair) => parseInt(pair, 16)))
    return new TextDecoder().decode(bytes).replace(/\0/g, '').trim() || null
  } catch {
    return null
  }
}