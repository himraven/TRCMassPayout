# Internal API Contracts

This document defines the TypeScript-facing internal service contracts for the TRC Mass Payout application. These interfaces are intentionally Mode B first, while keeping a stable abstraction for future Mode A support.

## Shared Domain Types

### Common Status Types

- `BatchLifecycle`: `Draft | Validated | Paying | Completed`
- `PayoutItemStatus`: `Pending | Signed | Broadcast | Confirming | Success | Failed`
- `PayoutErrorCode`: `INVALID_ADDRESS | INSUFFICIENT_BALANCE | INSUFFICIENT_ENERGY | INSUFFICIENT_BANDWIDTH | NODE_TIMEOUT | BROADCAST_REJECTED | CONFIRM_TIMEOUT`

## 1. `IWalletService`

Responsibilities:

- manage TronLink connectivity
- expose wallet address and balances
- sign transactions without exporting keys

```ts
interface IWalletService {
  connect(): Promise<WalletSnapshot>
  disconnect(): Promise<void>
  getBalance(address?: string): Promise<WalletBalance>
  getAddress(): Promise<string | null>
  signTransaction(unsignedTransaction: TronUnsignedTransaction): Promise<TronSignedTransaction>
}
```

### Notes

- `connect` should reject when TronLink is unavailable or locked.
- `getBalance` returns both TRX and USDT balances plus energy and bandwidth estimates.
- `signTransaction` must delegate to TronLink only.

## 2. `IImporterService`

Responsibilities:

- parse CSV and XLSX files
- normalize imported rows
- validate a batch before execution
- expose validation errors in a deterministic structure

```ts
interface IImporterService {
  parseFile(file: File): Promise<ImportedBatchDraft>
  validateBatch(input: ImportedBatchDraft, walletBalance?: WalletBalance): Promise<ValidationResult>
  getErrors(): ImportValidationError[]
}
```

### Notes

- `parseFile` returns rows plus file metadata.
- `validateBatch` applies Base58Check, precision, duplicate, and budget checks.
- `getErrors` returns the latest validation snapshot for UI rendering.

## 3. `IBatchManager`

Responsibilities:

- persist batches and payout items
- retrieve batch details and lists
- update lifecycle status and aggregate counters

```ts
interface IBatchManager {
  createBatch(input: CreateBatchInput): Promise<BatchRecord>
  getBatch(batchId: string): Promise<BatchRecord | null>
  listBatches(): Promise<BatchListItem[]>
  updateStatus(batchId: string, status: BatchLifecycle): Promise<void>
}
```

### Notes

- `createBatch` persists both batch metadata and normalized payout items.
- `updateStatus` must append audit log entries and update timestamps.

## 4. `IPayoutEngine` as `PayoutProvider`

Responsibilities:

- build, sign, and broadcast payout transactions
- query chain state for in-flight transactions

```ts
interface PayoutProvider {
  buildTransaction(input: BuildTransactionInput): Promise<TronUnsignedTransaction>
  sign(unsignedTransaction: TronUnsignedTransaction): Promise<TronSignedTransaction>
  broadcast(signedTransaction: TronSignedTransaction): Promise<BroadcastResult>
  getStatus(txId: string): Promise<TransactionStatusResult>
}
```

### Notes

- Mode B implements this through TronLink and TronWeb.
- Mode A is a reserved future provider.

## 5. `IChainWatcher`

Responsibilities:

- monitor transaction status
- derive confirmation results
- expose subscription callbacks for UI and orchestration

```ts
interface IChainWatcher {
  watch(txId: string, payoutItemId: string): Promise<void>
  getConfirmation(txId: string): Promise<TransactionStatusResult>
  subscribe(listener: WatcherListener): () => void
}
```

### Notes

- `watch` persists checkpoints and resumes after reload.
- `subscribe` emits watcher events to the store and event bus.

## 6. `IReceiptRenderer`

Responsibilities:

- generate visual receipt assets
- provide checksum generation

```ts
interface IReceiptRenderer {
  render(
    input: ReceiptRenderInput,
  ): Promise<{ pngDataUrl: string; pdfDataUrl: string }>
  generateChecksum(input: ReceiptChecksumInput): Promise<string>
}
```

### Notes

- `render` outputs both PNG and PDF artifacts.
- `generateChecksum` returns a SHA256 hash for archive verification.

## 7. `IExporter`

Responsibilities:

- package outputs for audit and delivery
- export normalized CSV data alongside ZIP payloads

```ts
interface IExporter {
  exportZip(batchId: string): Promise<Blob>
  exportCSV(batchId: string): Promise<string>
}
```

## 8. Supporting Types

```ts
type BatchLifecycle = 'Draft' | 'Validated' | 'Paying' | 'Completed'

type PayoutItemStatus =
  | 'Pending'
  | 'Signed'
  | 'Broadcast'
  | 'Confirming'
  | 'Success'
  | 'Failed'

type PayoutErrorCode =
  | 'INVALID_ADDRESS'
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_ENERGY'
  | 'INSUFFICIENT_BANDWIDTH'
  | 'NODE_TIMEOUT'
  | 'BROADCAST_REJECTED'
  | 'CONFIRM_TIMEOUT'
```

## 9. Design Principles

- service interfaces remain UI-agnostic
- all transaction flow is idempotent by local state
- wallet keys remain inside TronLink
- IndexedDB is the source of truth for resumable operations
