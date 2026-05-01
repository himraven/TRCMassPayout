import { db } from '../../db/schema'
import type { BatchRecord, CreateBatchInput, IBatchManager } from '../../types'

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

  async updateStatus(batchId: string, status: BatchRecord['lifecycle']) {
    await db.batches.update(batchId, {
      lifecycle: status,
      updatedAt: new Date().toISOString(),
    })
  }
}

export const batchManager = new BatchManagerService()