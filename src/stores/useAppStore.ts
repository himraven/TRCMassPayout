import { create } from 'zustand'
import type { AppState } from '../types'
import { walletService } from '../modules/wallet'
import { sampleBatches } from './mockData'

const emptyBalance = {
  trxBalanceSun: '0',
  usdtBalance: '0',
  energyAvailable: 0,
  bandwidthAvailable: 0,
}

const emptyEstimate = walletService.estimateEnergy(emptyBalance)

export const useAppStore = create<AppState>((set, get) => {
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

  void applySnapshot()

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
    batches: sampleBatches,
    addBatch: (batch) =>
      set((state) => ({
        batches: [batch, ...state.batches],
      })),
    setBatches: (batches) => set({ batches }),
    settings: {
      concurrency: 6,
      confirmationTimeoutMs: 120000,
      resumeOnReload: true,
    },
  }
})