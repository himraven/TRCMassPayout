export type BatchLifecycle = 'Draft' | 'Validated' | 'Paying' | 'Completed'

export type PayoutItemStatus =
  | 'Pending'
  | 'Signed'
  | 'Broadcast'
  | 'Confirming'
  | 'Success'
  | 'Failed'

export type PayoutErrorCode =
  | 'INVALID_ADDRESS'
  | 'INVALID_AMOUNT'
  | 'DUPLICATE_ADDRESS'
  | 'MISSING_FIELD'
  | 'PRECISION_EXCEEDED'
  | 'BUDGET_EXCEEDED'
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_ENERGY'
  | 'INSUFFICIENT_BANDWIDTH'
  | 'NODE_TIMEOUT'
  | 'BROADCAST_REJECTED'
  | 'CONFIRM_TIMEOUT'

export interface BatchRecord {
  id: string
  name: string
  sourceFileName: string
  lifecycle: BatchLifecycle
  status: string
  network: string
  senderAddress: string
  tokenSymbol: string
  tokenContract: string
  totalCount: number
  validCount: number
  invalidCount: number
  successCount: number
  failedCount: number
  totalAmount: string
  estimatedEnergy: number
  estimatedBandwidth: number
  concurrency: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PayoutItemRecord {
  id: string
  batchId: string
  lineNumber: number
  recipient: string
  maskedRecipient: string
  amount: string
  reference?: string
  status: PayoutItemStatus
  errorCode: PayoutErrorCode | null
  errorMessage: string | null
  txId: string | null
  explorerUrl: string | null
  idempotencyKey: string
  attemptCount: number
  signedAt: string | null
  broadcastAt: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReceiptRecord {
  id: string
  batchId: string
  payoutItemId: string
  txId: string
  sender: string
  recipient: string
  maskedRecipient: string
  amount: string
  network: string
  status: 'Success'
  checksumSha256: string
  pngDataUrl: string
  pdfDataUrl: string
  qrValue: string
  generatedAt: string
  timezone: string
}

export interface AuditLogRecord {
  id: string
  batchId: string | null
  payoutItemId: string | null
  action: string
  fromStatus: string | null
  toStatus: string | null
  actor: 'system' | 'user' | 'wallet'
  message: string
  metadataJson: string
  createdAt: string
}

export interface WalletCacheRecord {
  address: string
  network: string
  trxBalanceSun: string
  usdtBalance: string
  energyAvailable: number
  bandwidthAvailable: number
  lastSyncedAt: string
}

export interface WalletBalance {
  trxBalanceSun: string
  usdtBalance: string
  energyAvailable: number
  bandwidthAvailable: number
}

export interface WalletEnergyEstimate {
  energyPerTransfer: number
  estimatedTrxCostSun: string
  estimatedTransfersSupported: number
  lowTrxWarning: boolean
  lowEnergyWarning: boolean
}

export interface WalletSnapshot {
  address: string
  network: string
  balance: WalletBalance
}

export interface WalletState {
  connected: boolean
  address: string | null
  network: string
  balance: WalletBalance
  energyEstimate: WalletEnergyEstimate
  isConnecting: boolean
  lastSyncedAt: string | null
}

export interface ImportedBatchRow {
  lineNumber: number
  recipientName: string
  address: string
  amount: string
  contactEmail?: string
  contactTelegram?: string
  raw: Record<string, string>
}

export interface ImportedBatchDraft {
  fileName: string
  fileType: 'csv' | 'xlsx'
  columnMap: {
    recipientName: string | null
    address: string | null
    amount: string | null
    contactEmail: string | null
    contactTelegram: string | null
  }
  rows: ImportedBatchRow[]
}

export interface ImportValidationError {
  field:
    | 'recipient_name'
    | 'address'
    | 'amount'
    | 'contact_email'
    | 'contact_telegram'
    | 'batch'
  lineNumber: number
  code: PayoutErrorCode
  message: string
}

export interface ValidationRowResult {
  rowNumber: number
  status: 'valid' | 'warning' | 'error'
  errors: ImportValidationError[]
  item: ImportedBatchRow
}

export interface ValidationResult {
  rows: ValidationRowResult[]
  totalRows: number
  validCount: number
  warningCount: number
  errorCount: number
  totalAmount: string
  estimatedTrxCost: string
  errors: ImportValidationError[]
}

export interface ValidationRuleViewModel {
  label: string
  description: string
  state: BatchLifecycle
}

export interface BuildTransactionInput {
  sender: string
  recipient: string
  amount: string
  tokenContract: string
}

export interface TronUnsignedTransaction {
  rawData: Record<string, unknown>
}

export interface TronSignedTransaction extends TronUnsignedTransaction {
  signature?: string[]
  txID?: string
}

export interface BroadcastResult {
  txId: string
  accepted: boolean
  explorerUrl: string
}

export interface TransactionStatusResult {
  txId: string
  status: PayoutItemStatus
  updatedAt: string
  explorerUrl: string
  errorCode?: PayoutErrorCode
}

export interface ReceiptRenderInput {
  batchId: string
  sender: string
  recipient: string
  maskedRecipient: string
  amount: string
  txId: string
}

export interface ReceiptChecksumInput extends ReceiptRenderInput {
  confirmedAt: string
}

export type BatchListItem = BatchRecord

export interface CreateBatchInput {
  batch: BatchRecord
  items: PayoutItemRecord[]
}

export interface WatcherEvent extends TransactionStatusResult {
  payoutItemId: string
}

export type WatcherListener = (event: WatcherEvent) => void

export interface AppState {
  wallet: WalletState
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
  refreshWalletBalances: () => Promise<void>
  batches: BatchRecord[]
  settings: {
    concurrency: number
    confirmationTimeoutMs: number
    resumeOnReload: boolean
  }
  addBatch: (batch: BatchRecord) => void
  setBatches: (batches: BatchRecord[]) => void
}