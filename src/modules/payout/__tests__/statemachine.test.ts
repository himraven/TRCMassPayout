import { describe, expect, it, vi } from 'vitest'
import { db } from '../../../db/schema'
import { batchManager } from '../../batch'
import { chainWatcher } from '../../watcher'
import {
  canProcessPayoutItemStatus,
  getRecoveryStatus,
  TronLinkPayoutProvider,
} from '../index'
import type { BatchRecord, ExecutionSettings, PayoutItemRecord } from '../../../types'

const settings: ExecutionSettings = {
  concurrency: 1,
  feeLimitTrx: 30,
  confirmationTimeoutMinutes: 10,
  resumeOnReload: false,
  senderIdentity: 'Tester',
}

function buildBatch(): BatchRecord {
  const now = new Date().toISOString()
  return {
    id: 'batch-1',
    name: 'Batch 1',
    sourceFileName: 'batch.csv',
    lifecycle: 'Paying',
    status: 'Running',
    network: 'Nile',
    senderAddress: 'TLrMR4ScAMb3iFBZd9eVJMXQAL8a8Fvm7a',
    tokenSymbol: 'USDT',
    tokenContract: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    totalCount: 1,
    validCount: 1,
    invalidCount: 0,
    successCount: 0,
    failedCount: 0,
    totalAmount: '1.000000',
    estimatedEnergy: 0,
    estimatedBandwidth: 0,
    concurrency: 1,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function buildItem(overrides: Partial<PayoutItemRecord> = {}): PayoutItemRecord {
  const now = new Date().toISOString()
  return {
    id: 'item-1',
    batchId: 'batch-1',
    lineNumber: 2,
    recipient: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    maskedRecipient: 'TR7NHq****Lj6t',
    amount: '1.000000',
    reference: 'Alice',
    status: 'Pending',
    errorCode: null,
    errorMessage: null,
    txId: null,
    explorerUrl: null,
    idempotencyKey: 'idem-1',
    attemptCount: 0,
    signedAt: null,
    broadcastAt: null,
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

async function seedBaseBatch() {
  await db.batches.put(buildBatch())
}

describe('payout state machine', () => {
  it('allows Pending -> Signing -> Broadcast -> Confirming -> Success', async () => {
    await db.batches.put(buildBatch())
    await db.payoutItems.put(buildItem())

    await batchManager.updatePayoutItem('item-1', { status: 'Signing' })
    await batchManager.updatePayoutItem('item-1', { status: 'Broadcast', txId: 'tx-1' })
    await batchManager.updatePayoutItem('item-1', { status: 'Confirming' })
    await batchManager.updatePayoutItem('item-1', { status: 'Success', confirmedAt: new Date().toISOString() })

    expect((await db.payoutItems.get('item-1'))?.status).toBe('Success')
  })

  it('allows any state to move to Failed', async () => {
    await seedBaseBatch()
    const statuses: PayoutItemRecord['status'][] = ['Pending', 'Signing', 'Broadcast', 'Confirming']
    for (const status of statuses) {
      const id = `item-${status}`
      await db.payoutItems.put(buildItem({ id, status }))
      await batchManager.updatePayoutItem(id, { status: 'Failed', errorCode: 'BROADCAST_REJECTED', errorMessage: 'boom' })
      expect((await db.payoutItems.get(id))?.status).toBe('Failed')
    }
  })

  it('does not process Success items', () => {
    expect(canProcessPayoutItemStatus('Success')).toBe(false)
  })

  it('does not process Failed items unless retried to Pending', async () => {
    await seedBaseBatch()
    expect(canProcessPayoutItemStatus('Failed')).toBe(false)
    await db.payoutItems.put(buildItem({ id: 'retry-item', status: 'Failed' }))
    await batchManager.updatePayoutItem('retry-item', { status: 'Pending', errorCode: null, errorMessage: null })
    expect((await db.payoutItems.get('retry-item'))?.status).toBe('Pending')
    expect(canProcessPayoutItemStatus('Pending')).toBe(true)
  })

  it('skips idempotent already Broadcast items', async () => {
    const provider = new TronLinkPayoutProvider()
    await db.batches.put(buildBatch())
    await db.payoutItems.put(buildItem({ status: 'Broadcast', txId: 'tx-1' }))
    const watchSpy = vi.spyOn(chainWatcher, 'watch').mockResolvedValue()
    const buildSpy = vi.spyOn(provider, 'buildTransaction')

    await (provider as any).processItem(buildItem({ status: 'Broadcast', txId: 'tx-1' }), settings)

    expect(buildSpy).not.toHaveBeenCalled()
    expect(watchSpy).not.toHaveBeenCalled()
  })

  it('recovers Signing items to Pending', () => {
    expect(getRecoveryStatus({ status: 'Signing', txId: null })).toBe('Pending')
  })

  it('recovers Broadcast with txId to Confirming', () => {
    expect(getRecoveryStatus({ status: 'Broadcast', txId: 'tx-1' })).toBe('Confirming')
  })

  it('recovers Broadcast without txId to Pending', () => {
    expect(getRecoveryStatus({ status: 'Broadcast', txId: null })).toBe('Pending')
  })

  it('recover updates database states and resumes watching', async () => {
    const provider = new TronLinkPayoutProvider()
    await db.batches.put(buildBatch())
    await db.payoutItems.bulkPut([
      buildItem({ id: 'signing', status: 'Signing' }),
      buildItem({ id: 'broadcast-with', status: 'Broadcast', txId: 'tx-2' }),
      buildItem({ id: 'broadcast-without', status: 'Broadcast', txId: null }),
      buildItem({ id: 'confirming', status: 'Confirming', txId: 'tx-3' }),
    ])
    const watchSpy = vi.spyOn(chainWatcher, 'watch').mockResolvedValue()

    await provider.recover(settings)

    expect((await db.payoutItems.get('signing'))?.status).toBe('Pending')
    expect((await db.payoutItems.get('broadcast-with'))?.status).toBe('Confirming')
    expect((await db.payoutItems.get('broadcast-without'))?.status).toBe('Pending')
    expect(watchSpy).toHaveBeenCalledTimes(2)
  })
})