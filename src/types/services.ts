import type {
  BatchLifecycle,
  BatchListItem,
  BatchRecord,
  BroadcastResult,
  BuildTransactionInput,
  CreateBatchInput,
  ImportedBatchDraft,
  ImportValidationError,
  ReceiptChecksumInput,
  ReceiptRenderInput,
  TransactionStatusResult,
  TronSignedTransaction,
  TronUnsignedTransaction,
  WalletBalance,
  WalletSnapshot,
  WatcherListener,
} from './domain'

export interface IWalletService {
  connect(): Promise<WalletSnapshot>
  disconnect(): Promise<void>
  getBalance(address?: string): Promise<WalletBalance>
  getAddress(): Promise<string | null>
  signTransaction(
    unsignedTransaction: TronUnsignedTransaction,
  ): Promise<TronSignedTransaction>
}

export interface IImporterService {
  parseFile(file: File): Promise<ImportedBatchDraft>
  validateBatch(
    input: ImportedBatchDraft,
    walletBalance?: WalletBalance,
  ): Promise<{
    validRows: number
    invalidRows: number
    totalAmount: string
    duplicates: number
    errors: ImportValidationError[]
  }>
  getErrors(): ImportValidationError[]
}

export interface IBatchManager {
  createBatch(input: CreateBatchInput): Promise<BatchRecord>
  getBatch(batchId: string): Promise<BatchRecord | null>
  listBatches(): Promise<BatchListItem[]>
  updateStatus(batchId: string, status: BatchLifecycle): Promise<void>
}

export interface PayoutProvider {
  buildTransaction(
    input: BuildTransactionInput,
  ): Promise<TronUnsignedTransaction>
  sign(
    unsignedTransaction: TronUnsignedTransaction,
  ): Promise<TronSignedTransaction>
  broadcast(
    signedTransaction: TronSignedTransaction,
  ): Promise<BroadcastResult>
  getStatus(txId: string): Promise<TransactionStatusResult>
}

export type IPayoutEngine = PayoutProvider

export interface IChainWatcher {
  watch(txId: string, payoutItemId: string): Promise<void>
  getConfirmation(txId: string): Promise<TransactionStatusResult>
  subscribe(listener: WatcherListener): () => void
}

export interface IReceiptRenderer {
  render(
    input: ReceiptRenderInput,
  ): Promise<{ pngDataUrl: string; pdfDataUrl: string }>
  generateChecksum(input: ReceiptChecksumInput): Promise<string>
}

export interface IExporter {
  exportZip(batchId: string): Promise<Blob>
  exportCSV(batchId: string): Promise<string>
}