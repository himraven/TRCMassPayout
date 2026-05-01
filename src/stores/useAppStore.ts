import { create } from 'zustand'
import type { AppState } from '../types'
import { sampleBatches } from './mockData'

export const useAppStore = create<AppState>(() => ({
  wallet: {
    connected: false,
    address: null,
    network: 'TRON Mainnet',
    balance: {
      trxBalanceSun: '0',
      usdtBalance: '0',
      energyAvailable: 0,
      bandwidthAvailable: 0,
    },
  },
  batches: sampleBatches,
  settings: {
    concurrency: 6,
    confirmationTimeoutMs: 120000,
    resumeOnReload: true,
  },
}))