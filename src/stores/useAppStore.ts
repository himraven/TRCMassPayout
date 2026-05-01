import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState } from '../types'
import { batchManager } from '../modules/batch'
import { payoutEngine } from '../modules/payout'
import { walletService } from '../modules/wallet'
import { eventBus } from '../utils/eventBus'

const emptyBalance = {
  trxBalanceSun: '0',
  usdtBalance: '0',
  energyAvailable: 0,
  bandwidthAvailable: 0,
}

const emptyEstimate = walletService.estimateEnergy(emptyBalance)
const emptyProgress = {
  total: 0,
  pending: 0,
  signing: 0,
  broadcast: 0,
  confirming: 0,
  success: 0,
  failed: 0,
  terminal: 0,
}
let hasRecovered = false

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
  let unsubscribeWallet: (() => void) | null = null

  const applySnapshot = async () => {
    const snapshot = await walletService.restoreConnection()
    if (!snapshot) {
      return
    }

    ensureSubscription()
    set({
      wallet: {
        connected: true,
        address: snapshot.address,
        network: snapshot.network,
        balance: snapshot.balance,
        energyEstimate: walletService.estimateEnergy(snapshot.balance),
        isConnecting: false,
        lastSyncedAt: new Date().toISOString(),
      },
    })
  }

  const refreshBatches = async () => {
    const batches = await batchManager.listBatches()
    set({ batches })
  }

  const refreshExecutionProgress = async (batchId?: string | null) => {
    const targetBatchId = batchId ?? get().batchExecutionState.activeBatchId

    if (!targetBatchId) {
      set((state) => ({
        batchExecutionState: {
          ...state.batchExecutionState,
          progress: emptyProgress,
        },
      }))
      return
    }

    const progress = await batchManager.getBatchProgress(targetBatchId)
    set((state) => ({
      batchExecutionState: {
        ...state.batchExecutionState,
        progress,
      },
    }))
  }

  void applySnapshot()
  void refreshBatches()

  const ensureSubscription = () => {
    if (unsubscribeWallet) {
      return
    }

    unsubscribeWallet = walletService.subscribe({
      onAccountsChanged: async (accounts) => {
        const nextAddress = accounts[0]

        if (!nextAddress) {
          await get().disconnectWallet()
          return
        }

        await get().refreshWalletBalances()
      },
      onDisconnect: async () => {
        await get().disconnectWallet()
      },
    })
  }

  eventBus.subscribe('batch.progress', ({ batchId, progress }) => {
    void refreshBatches()
    set((state) => ({
      batchExecutionState: {
        ...state.batchExecutionState,
        activeBatchId:
          state.batchExecutionState.activeBatchId === batchId
            ? batchId
            : state.batchExecutionState.activeBatchId,
        progress:
          state.batchExecutionState.activeBatchId === batchId
            ? progress
            : state.batchExecutionState.progress,
      },
    }))
  })

  eventBus.subscribe('batch.completed', ({ batchId }) => {
    void refreshBatches()
    set((state) => ({
      batchExecutionState: {
        ...state.batchExecutionState,
        isRunning:
          state.batchExecutionState.activeBatchId === batchId
            ? false
            : state.batchExecutionState.isRunning,
        isPaused:
          state.batchExecutionState.activeBatchId === batchId
            ? false
            : state.batchExecutionState.isPaused,
      },
    }))
  })

  if (!hasRecovered) {
    hasRecovered = true
    void payoutEngine.recover(get().settings).then(() => refreshBatches())
  }

  return {
    wallet: {
      connected: false,
      address: null,
      network: 'TRON Mainnet',
      balance: emptyBalance,
      energyEstimate: emptyEstimate,
      isConnecting: false,
      lastSyncedAt: null,
    },
    connectWallet: async () => {
      set((state) => ({
        wallet: {
          ...state.wallet,
          isConnecting: true,
        },
      }))

      try {
        const snapshot = await walletService.connect()
        ensureSubscription()
        set({
          wallet: {
            connected: true,
            address: snapshot.address,
            network: snapshot.network,
            balance: snapshot.balance,
            energyEstimate: walletService.estimateEnergy(snapshot.balance),
            isConnecting: false,
            lastSyncedAt: new Date().toISOString(),
          },
        })
      } catch (error) {
        set((state) => ({
          wallet: {
            ...state.wallet,
            isConnecting: false,
          },
        }))
        throw error
      }
    },
    disconnectWallet: async () => {
      unsubscribeWallet?.()
      unsubscribeWallet = null
      await walletService.disconnect()
      set({
        wallet: {
          connected: false,
          address: null,
          network: 'TRON Mainnet',
          balance: emptyBalance,
          energyEstimate: emptyEstimate,
          isConnecting: false,
          lastSyncedAt: null,
        },
      })
    },
    refreshWalletBalances: async () => {
      const address = await walletService.getAddress()

      if (!address) {
        await get().disconnectWallet()
        return
      }

      const balance = await walletService.getBalance(address)
      set((state) => ({
        wallet: {
          ...state.wallet,
          connected: true,
          address,
          network: state.wallet.network,
          balance,
          energyEstimate: walletService.estimateEnergy(balance),
          lastSyncedAt: new Date().toISOString(),
        },
      }))
    },
    batches: [],
    batchExecutionState: {
      isRunning: false,
      isPaused: false,
      activeBatchId: null,
      progress: emptyProgress,
    },
    addBatch: (batch) =>
      set((state) => ({
        batches: [batch, ...state.batches],
      })),
    setBatches: (batches) => set({ batches }),
    refreshBatches,
    refreshExecutionProgress,
    settings: {
      concurrency: 5,
      feeLimitTrx: 150,
      confirmationTimeoutMinutes: 10,
      resumeOnReload: true,
      senderIdentity: 'TRC Mass Payout',
    },
    updateSettings: (settings) =>
      set((state) => ({
        settings: {
          ...state.settings,
          ...settings,
        },
      })),
    startBatch: async (batchId) => {
      await payoutEngine.startBatch(batchId, get().settings)
      await refreshBatches()
      await refreshExecutionProgress(batchId)
      set((state) => ({
        batchExecutionState: {
          ...state.batchExecutionState,
          isRunning: true,
          isPaused: false,
          activeBatchId: batchId,
        },
      }))
    },
    pauseBatch: async () => {
      const batchId = get().batchExecutionState.activeBatchId

      if (!batchId) {
        return
      }

      await payoutEngine.pauseBatch(batchId)
      await refreshBatches()
      await refreshExecutionProgress(batchId)
      set((state) => ({
        batchExecutionState: {
          ...state.batchExecutionState,
          isRunning: false,
          isPaused: true,
        },
      }))
    },
    resumeBatch: async () => {
      const batchId = get().batchExecutionState.activeBatchId

      if (!batchId) {
        return
      }

      await payoutEngine.resumeBatch(batchId, get().settings)
      await refreshBatches()
      await refreshExecutionProgress(batchId)
      set((state) => ({
        batchExecutionState: {
          ...state.batchExecutionState,
          isRunning: true,
          isPaused: false,
        },
      }))
    },
    retryFailed: async (batchId, itemIds) => {
      await payoutEngine.retryFailed(batchId, itemIds, get().settings)
      await refreshBatches()
      await refreshExecutionProgress(batchId)
      set((state) => ({
        batchExecutionState: {
          ...state.batchExecutionState,
          isRunning: true,
          isPaused: false,
          activeBatchId: batchId,
        },
      }))
    },
  }
},
    {
      name: 'trc-mass-payout-settings',
      partialize: (state) => ({
        settings: state.settings,
      }),
    },
  ),
)