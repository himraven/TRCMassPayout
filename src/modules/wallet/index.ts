import type {
  IWalletService,
  TronSignedTransaction,
  TronUnsignedTransaction,
  WalletEnergyEstimate,
  WalletBalance,
  WalletSnapshot,
} from '../../types'
import { db } from '../../db/schema'
import { eventBus } from '../../utils/eventBus'

const MAINNET_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const NILE_USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
const ENERGY_PER_USDT_TRANSFER = 65000
const LOW_TRX_THRESHOLD_SUN = 30_000_000
const LOW_ENERGY_THRESHOLD = ENERGY_PER_USDT_TRANSFER
const CONNECTION_CACHE_KEY = 'wallet:lastConnectedAddress'

export class WalletService implements IWalletService {
  async connect(): Promise<WalletSnapshot> {
    const tronLink = window.tronLink
    const tronWeb = window.tronWeb

    if (!tronLink && !tronWeb) {
      throw new Error('TronLink is not installed')
    }

    await this.requestAccess()

    if (!tronWeb?.defaultAddress?.base58) {
      throw new Error('TronLink is unavailable or locked')
    }

    const address = tronWeb.defaultAddress.base58
    const balance = await this.getBalance(address)
    const snapshot = {
      address,
      network: this.getNetworkName(),
      balance,
    }

    await this.persistSnapshot(snapshot)
    localStorage.setItem(CONNECTION_CACHE_KEY, address)
    eventBus.emit('wallet.connected', { address, network: snapshot.network })

    return snapshot
  }

  async disconnect(): Promise<void> {
    const address = await this.getAddress()
    if (address) {
      await db.walletCache.delete(address)
    }
    localStorage.removeItem(CONNECTION_CACHE_KEY)
    eventBus.emit('wallet.disconnected', { address })
    return Promise.resolve()
  }

  async restoreConnection(): Promise<WalletSnapshot | null> {
    const cachedAddress = localStorage.getItem(CONNECTION_CACHE_KEY)
    const liveAddress = await this.getAddress()

    if (!cachedAddress || !liveAddress || cachedAddress !== liveAddress) {
      return null
    }

    const balance = await this.getBalance(liveAddress)
    const snapshot = {
      address: liveAddress,
      network: this.getNetworkName(),
      balance,
    }

    await this.persistSnapshot(snapshot)

    return snapshot
  }

  async getBalance(address?: string): Promise<WalletBalance> {
    const tronWeb = window.tronWeb
    const ownerAddress = address ?? tronWeb?.defaultAddress?.base58

    if (!tronWeb || !ownerAddress) {
      return {
        trxBalanceSun: '0',
        usdtBalance: '0',
        energyAvailable: 0,
        bandwidthAvailable: 0,
      }
    }

    const trxBalanceSun = await tronWeb.trx.getBalance(ownerAddress)
    const resource = await tronWeb.trx.getAccountResources(ownerAddress)
    const balance = {
      trxBalanceSun: String(trxBalanceSun),
      usdtBalance: await this.getUsdtBalance(ownerAddress, tronWeb),
      energyAvailable: Number(resource.EnergyLimit ?? 0),
      bandwidthAvailable: Number(resource.freeNetLimit ?? 0),
    }

    await this.persistBalance(ownerAddress, balance)

    return balance
  }

  async getAddress() {
    return window.tronWeb?.defaultAddress?.base58 ?? null
  }

  subscribe({
    onAccountsChanged,
    onDisconnect,
  }: {
    onAccountsChanged?: (accounts: string[]) => void | Promise<void>
    onDisconnect?: () => void | Promise<void>
  }) {
    const tronLink = window.tronLink

    if (!tronLink?.on) {
      return () => undefined
    }

    const handleAccountsChanged = (...args: unknown[]) => {
      const [payload] = args
      if (Array.isArray(payload)) {
        void onAccountsChanged?.(payload.filter((value): value is string => typeof value === 'string'))
      }
    }
    const handleDisconnect = () => {
      void onDisconnect?.()
    }

    tronLink.on('accountsChanged', handleAccountsChanged)
    tronLink.on('disconnect', handleDisconnect)

    return () => {
      tronLink.off?.('accountsChanged', handleAccountsChanged)
      tronLink.off?.('disconnect', handleDisconnect)
    }
  }

  async signTransaction(
    unsignedTransaction: TronUnsignedTransaction,
  ): Promise<TronSignedTransaction> {
    if (!window.tronWeb?.trx?.sign) {
      throw new Error('TronLink signing is unavailable')
    }

    return (await window.tronWeb.trx.sign(
      unsignedTransaction,
    )) as TronSignedTransaction
  }

  private async getUsdtBalance(
    address: string,
    tronWeb: NonNullable<Window['tronWeb']>,
  ) {
    try {
      const contract = await tronWeb.contract().at(this.getUsdtContract())
      const balance = await contract.balanceOf(address).call()

      return (Number(String(balance)) / 1_000_000).toFixed(6)
    } catch {
      return '0'
    }
  }

  estimateEnergy(balance: WalletBalance): WalletEnergyEstimate {
    const trxBalanceSun = Number(balance.trxBalanceSun)
    const availableEnergy = balance.energyAvailable
    const energyDeficit = Math.max(0, ENERGY_PER_USDT_TRANSFER - availableEnergy)
    const estimatedTrxCostSun = energyDeficit * 420
    const transferCostSun = Math.max(estimatedTrxCostSun, 1_500_000)
    const estimatedTransfersSupported = transferCostSun
      ? Math.floor(trxBalanceSun / transferCostSun)
      : 0

    return {
      energyPerTransfer: ENERGY_PER_USDT_TRANSFER,
      estimatedTrxCostSun: String(estimatedTrxCostSun),
      estimatedTransfersSupported,
      lowTrxWarning: trxBalanceSun < LOW_TRX_THRESHOLD_SUN,
      lowEnergyWarning: availableEnergy < LOW_ENERGY_THRESHOLD,
    }
  }

  private getUsdtContract() {
    return this.isNileNetwork() ? NILE_USDT_CONTRACT : MAINNET_USDT_CONTRACT
  }

  private isNileNetwork() {
    const host = window.tronWeb?.fullNode?.host?.toLowerCase() ?? ''
    return host.includes('nile')
  }

  private getNetworkName() {
    return this.isNileNetwork() ? 'TRON Nile Testnet' : 'TRON Mainnet'
  }

  private async requestAccess() {
    if (window.tronLink?.request) {
      await window.tronLink.request({ method: 'tron_requestAccounts' })
      return
    }

    if (!window.tronWeb?.defaultAddress?.base58) {
      throw new Error('Approve the wallet connection in TronLink')
    }
  }

  private async persistSnapshot(snapshot: WalletSnapshot) {
    await this.persistBalance(snapshot.address, snapshot.balance, snapshot.network)
  }

  private async persistBalance(
    address: string,
    balance: WalletBalance,
    network = this.getNetworkName(),
  ) {
    await db.walletCache.put({
      address,
      network,
      trxBalanceSun: balance.trxBalanceSun,
      usdtBalance: balance.usdtBalance,
      energyAvailable: balance.energyAvailable,
      bandwidthAvailable: balance.bandwidthAvailable,
      lastSyncedAt: new Date().toISOString(),
    })
  }
}

export const walletService = new WalletService()