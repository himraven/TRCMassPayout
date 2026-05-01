import type TronWeb from 'tronweb'

declare global {
  interface TronLinkProvider {
    ready?: boolean
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    on?: (
      event: 'accountsChanged' | 'disconnect',
      handler: (...args: unknown[]) => void,
    ) => void
    off?: (
      event: 'accountsChanged' | 'disconnect',
      handler: (...args: unknown[]) => void,
    ) => void
  }

  interface Window {
    tronWeb?: TronWeb & {
      defaultAddress?: {
        base58?: string
      }
      fullNode?: {
        host?: string
      }
    }
    tronLink?: TronLinkProvider
  }
}

export {}