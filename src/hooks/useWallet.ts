import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'

export function useWallet() {
  const wallet = useAppStore((state) => state.wallet)
  const connect = useAppStore((state) => state.connectWallet)
  const disconnect = useAppStore((state) => state.disconnectWallet)
  const refreshBalances = useAppStore((state) => state.refreshWalletBalances)
  const pushToast = useToastStore((state) => state.pushToast)
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
          pushToast({
            tone: 'error',
            title: 'Wallet connection failed',
            description:
              connectionError instanceof Error
                ? connectionError.message
                : 'Failed to connect TronLink',
          })
        }
      },
      disconnect: async () => {
        setError(null)
        await disconnect()
        pushToast({
          tone: 'info',
          title: 'Wallet disconnected',
          description: 'Reconnect TronLink when you are ready to resume payouts.',
        })
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
          pushToast({
            tone: 'error',
            title: 'Balance refresh failed',
            description:
              refreshError instanceof Error
                ? refreshError.message
                : 'Failed to refresh balances',
          })
        }
      },
    }),
    [connect, disconnect, error, pushToast, refreshBalances, wallet],
  )
}