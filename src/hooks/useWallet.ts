import { useAppStore } from '../stores/useAppStore'

export function useWallet() {
  return useAppStore((state) => state.wallet)
}