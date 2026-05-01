import type {
  BatchProgress,
  BatchLifecycle,
  BatchListItem,
  BatchRecord,
  BroadcastResult,
  BuildTransactionInput,
  CreateBatchInput,
  ExecutionSettings,
  ImportedBatchDraft,
  ImportValidationError,
  PayoutItemRecord,
  ReceiptChecksumInput,
  ReceiptRenderInput,
  TransactionStatusResult,
  TronSignedTransaction,
  TronUnsignedTransaction,
  ValidationResult,
  WalletBalance,
  WalletSnapshot,
  WatcherListener,
} from './domain'

export interface IWalletService {
  connect(): Promise<WalletSnapshot>
  disconnect(): Promise<void>
  getBalance(address?: string): Promise<WalletBalance>
  getAddress(): Promise<string | null>
  restoreConnection(): Promise<WalletSnapshot | null>
  subscribe(
    handlers: {
      onAccountsChanged?: (accounts: string[]) => void | Promise<void>
      onDisconnect?: () => void | Promise<void>
    },
  ): () => void
  signTransaction(
    unsignedTransaction: TronUnsignedTransaction,
  ): Promise<TronSignedTransaction>
}

export interface IImporterService {
  parseFile(file: File): Promise<ImportedBatchDraft>
  validateBatch(
    input: ImportedBatchDraft,
    walletBalance?: WalletBalance,
  ): Promise<ValidationResult>
  getErrors(): ImportValidationError[]
}

export interface IBatchManager {
  createBatch(input: CreateBatchInput): Promise<BatchRecord>
  getBatch(batchId: string): Promise<BatchRecord | null>
  listBatches(): Promise<BatchListItem[]>
  listBatchItems(batchId: string): Promise<PayoutItemRecord[]>
  updateStatus(batchId: string, status: BatchLifecycle): Promise<void>
  updateBatch(
    batchId: string,
    changes: Partial<BatchRecord>,
  ): Promise<void>
  updatePayoutItem(
    itemId: string,
    changes: Partial<PayoutItemRecord>,
  ): Promise<void>
  getBatchProgress(batchId: string): Promise<BatchProgress>
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

export interface IPayoutEngine extends PayoutProvider {
  startBatch(batchId: string, settings: ExecutionSettings): Promise<void>
  pauseBatch(batchId: string, reason?: string): Promise<void>
  resumeBatch(batchId: string, settings: ExecutionSettings): Promise<void>
  retryFailed(
    batchId: string,
    itemIds: string[],
    settings: ExecutionSettings,
  ): Promise<void>
  recover(settings: ExecutionSettings): Promise<void>
}

export interface IChainWatcher {
  watch(
    txId: string,
    payoutItemId: string,
    batchId: string,
    settings?: Pick<ExecutionSettings, 'confirmationTimeoutMinutes'>,
  ): Promise<void>
  getConfirmation(txId: string): Promise<TransactionStatusResult>
  subscribe(listener: WatcherListener): () => void
}

export interface IReceiptRenderer {
  render(
    input: ReceiptRenderInput,
  ): Promise<{ pngBlob: Blob; pdfBlob: Blob; checksumSha256: string; qrValue: string }>
  generateChecksum(input: ReceiptChecksumInput): Promise<string>
  ensureReceiptForItem(payoutItemId: string): Promise<import('./domain').ReceiptRecord | null>
  getReceiptByItemId(payoutItemId: string): Promise<import('./domain').ReceiptRecord | null>
  listBatchReceipts(batchId: string): Promise<import('./domain').ReceiptRecord[]>
}

export interface IExporter {
  exportZip(batchId: string): Promise<Blob>
  exportCSV(batchId: string): Promise<Blob>
  exportPdfBundle(batchId: string): Promise<Blob>
}