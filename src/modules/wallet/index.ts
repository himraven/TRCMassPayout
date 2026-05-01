import type {
  IWalletService,
  TronSignedTransaction,
  TronUnsignedTransaction,
  WalletBalance,
  WalletSnapshot,
} from '../../types'

const USDT_PLACEHOLDER_CONTRACT = 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj'

export class WalletService implements IWalletService {
  async connect(): Promise<WalletSnapshot> {
    const tronWeb = window.tronWeb

    if (!tronWeb?.defaultAddress?.base58) {
      throw new Error('TronLink is not connected')
    }

    const address = tronWeb.defaultAddress.base58
    const balance = await this.getBalance(address)

    return {
      address,
      network: 'TRON Mainnet',
      balance,
    }
  }

  async disconnect(): Promise<void> {
    return Promise.resolve()
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

    return {
      trxBalanceSun: String(trxBalanceSun),
      usdtBalance: await this.getUsdtBalance(ownerAddress, tronWeb),
      energyAvailable: Number(resource.EnergyLimit ?? 0),
      bandwidthAvailable: Number(resource.freeNetLimit ?? 0),
    }
  }

  async getAddress() {
    return window.tronWeb?.defaultAddress?.base58 ?? null
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
      const contract = await tronWeb.contract().at(USDT_PLACEHOLDER_CONTRACT)
      const balance = await contract.balanceOf(address).call()

      return (Number(String(balance)) / 1_000_000).toFixed(6)
    } catch {
      return '0'
    }
  }
}

export const walletService = new WalletService()