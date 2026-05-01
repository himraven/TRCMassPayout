import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../stores/useAppStore'

export function useWallet() {
  const wallet = useAppStore((state) => state.wallet)
  const connect = useAppStore((state) => state.connectWallet)
  const disconnect = useAppStore((state) => state.disconnectWallet)
  const refreshBalances = useAppStore((state) => state.refreshWalletBalances)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!wallet.connected) {
      return
    }

    void refreshBalances()
    const interval = window.setInterval(() => {
      void refreshBalances()
    }, 15000)

    return () => window.clearInterval(interval)
  }, [wallet.connected, refreshBalances])

  return useMemo(
    () => ({
      ...wallet,
      error,
      connect: async () => {
        try {
          setError(null)
          await connect()
        } catch (connectionError) {
          setError(
            connectionError instanceof Error
              ? connectionError.message
              : 'Failed to connect TronLink',
          )
        }
      },
      disconnect: async () => {
        setError(null)
        await disconnect()
      },
      refreshBalances: async () => {
        try {
          setError(null)
          await refreshBalances()
        } catch (refreshError) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : 'Failed to refresh balances',
          )
        }
      },
    }),
    [connect, disconnect, error, refreshBalances, wallet],
  )
}