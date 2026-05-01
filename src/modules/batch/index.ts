import { db } from '../../db/schema'
import type {
  BatchProgress,
  BatchRecord,
  CreateBatchInput,
  IBatchManager,
  PayoutItemRecord,
} from '../../types'

const emptyProgress: BatchProgress = {
  total: 0,
  pending: 0,
  signing: 0,
  broadcast: 0,
  confirming: 0,
  success: 0,
  failed: 0,
  terminal: 0,
}

export class BatchManagerService implements IBatchManager {
  async createBatch(input: CreateBatchInput): Promise<BatchRecord> {
    await db.transaction(
      'rw',
      [db.batches, db.payoutItems],
      async () => {
        await db.batches.put(input.batch)
        await db.payoutItems.bulkPut(input.items)
      },
    )

    return input.batch
  }

  async getBatch(batchId: string) {
    return (await db.batches.get(batchId)) ?? null
  }

  async listBatches() {
    return db.batches.orderBy('createdAt').reverse().toArray()
  }

  async listBatchItems(batchId: string) {
    return db.payoutItems.where('batchId').equals(batchId).sortBy('lineNumber')
  }

  async updateStatus(batchId: string, status: BatchRecord['lifecycle']) {
    await db.batches.update(batchId, {
      lifecycle: status,
      updatedAt: new Date().toISOString(),
    })
  }

  async updateBatch(batchId: string, changes: Partial<BatchRecord>) {
    await db.batches.update(batchId, {
      ...changes,
      updatedAt: new Date().toISOString(),
    })
  }

  async updatePayoutItem(itemId: string, changes: Partial<PayoutItemRecord>) {
    await db.payoutItems.update(itemId, {
      ...changes,
      updatedAt: new Date().toISOString(),
    })
  }

  async getBatchProgress(batchId: string) {
    const items = await this.listBatchItems(batchId)

    if (items.length === 0) {
      return emptyProgress
    }

    return items.reduce<BatchProgress>((progress, item) => {
      progress.total += 1
      if (item.status === 'Pending') {
        progress.pending += 1
      } else if (item.status === 'Signing') {
        progress.signing += 1
      } else if (item.status === 'Broadcast') {
        progress.broadcast += 1
      } else if (item.status === 'Confirming') {
        progress.confirming += 1
      } else if (item.status === 'Success') {
        progress.success += 1
        progress.terminal += 1
      } else if (item.status === 'Failed') {
        progress.failed += 1
        progress.terminal += 1
      }

      return progress
    }, { ...emptyProgress })
  }
}

export const batchManager = new BatchManagerService()