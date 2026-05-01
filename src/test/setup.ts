import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, vi } from 'vitest'
import { db } from '../db/schema'

Object.defineProperty(globalThis, 'crypto', {
  value: globalThis.crypto ?? webcrypto,
  configurable: true,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})