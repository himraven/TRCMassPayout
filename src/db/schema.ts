import Dexie, { type Table } from 'dexie'
import type {
  AuditLogRecord,
  BatchRecord,
  PayoutItemRecord,
  ReceiptRecord,
  WalletCacheRecord,
} from '../types'

export class TrcMassPayoutDB extends Dexie {
  batches!: Table<BatchRecord, string>
  payoutItems!: Table<PayoutItemRecord, string>
  receipts!: Table<ReceiptRecord, string>
  auditLogs!: Table<AuditLogRecord, string>
  walletCache!: Table<WalletCacheRecord, string>

  constructor() {
    super('trc-mass-payout')

    this.version(1).stores({
      batches: 'id, lifecycle, createdAt, updatedAt',
      payoutItems:
        'id, batchId, [batchId+status], recipient, txId, idempotencyKey, updatedAt',
      receipts: 'id, batchId, payoutItemId, txId, generatedAt',
      auditLogs: 'id, batchId, payoutItemId, action, createdAt',
      walletCache: 'address, network, lastSyncedAt',
    })

    this.version(2).stores({
      batches: 'id, lifecycle, createdAt, updatedAt',
      payoutItems:
        'id, batchId, [batchId+status], recipient, txId, idempotencyKey, updatedAt',
      receipts: 'id, batchId, payoutItemId, txId, checksumSha256, generatedAt',
      auditLogs: 'id, batchId, payoutItemId, action, createdAt',
      walletCache: 'address, network, lastSyncedAt',
    })
  }
}

export const db = new TrcMassPayoutDB()