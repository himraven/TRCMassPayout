# TRC-20 USDT Batch Payout Web App PRD

## 1. Product Overview

### 1.1 Product Name

TRC Mass Payout

### 1.2 Vision

TRC Mass Payout is a self-custodial batch payout web application for operations, finance, and web3 teams that need to send TRC-20 USDT to 100 to 1,000+ recipient addresses from a connected TronLink wallet. The application must keep private keys inside TronLink at all times and provide a resilient local-first workflow from import to receipt export.

### 1.3 Product Goal

The product enables batch payouts on TRON Mainnet with strong pre-flight validation, resumable execution, and auditable receipt generation without introducing custody, smart-contract batching, or backend dependency in V1.

### 1.4 Mode Strategy

- Mode B: self-custody only in V1
- Mode A: reserved for future expansion behind abstraction boundaries
- Non-custodial guarantee: private keys never leave TronLink

## 2. Target Users

### 2.1 Primary Personas

#### Operations Team

- Handles campaign or incentive distributions
- Needs fast bulk import and status visibility
- Needs crash recovery and exportable records

#### Finance Team

- Requires budget checks, duplicate prevention, and auditability
- Needs downloadable ZIP artifacts and payment receipts
- Needs clear failed-state classification

#### Web3 Team

- Understands wallet operations, energy, bandwidth, and transaction confirmation
- Needs wallet balance visibility and TronLink-native signing
- Needs direct explorer links and transaction tracing

### 2.2 Batch Size Expectations

- Typical: 100 to 500 payout addresses
- Heavy use: 500 to 1,000+ payout addresses
- V1 target must handle 500 transfers in a reasonable time under normal node conditions

## 3. Problem Statement

Teams currently rely on manual wallet operations, spreadsheets, and fragmented proof artifacts for TRC-20 payouts. This creates operational friction, inconsistent validation, double-send risk after browser crashes, and weak audit coverage. Users need a browser-native tool that validates inputs, signs transactions through TronLink, tracks on-chain outcomes, and produces standardized receipts and exports.

## 4. Product Scope

### 4.1 In Scope for V1

- TronLink wallet connection
- TRON Mainnet USDT TRC-20 payouts
- CSV and XLSX batch import
- Row validation and budget checks
- Batch execution with configurable concurrency
- In-browser persistence through IndexedDB
- Broadcast monitoring and confirmation tracking
- PNG and PDF receipt generation
- ZIP export with receipts, CSV, and metadata

### 4.2 Non-Goals for V1

- No email delivery or bot notification; export is ZIP only
- No smart-contract batch payout mode
- No fiat integration or settlement workflows
- No receiver-facing claim pages or portals
- No custodial signing or server-held keys

## 5. Core User Flow

1. Connect TronLink wallet
2. Read wallet state and balances
3. Import CSV or XLSX file
4. Parse and validate rows
5. Fix or remove invalid rows
6. Confirm budget and estimated energy readiness
7. Start payout batch
8. Build, sign, and broadcast transactions
9. Watch confirmations and recover from refreshes
10. Generate individual receipts
11. Export ZIP package with receipts and CSV summaries

## 6. Detailed Functional Requirements

### 6.1 Wallet Page

The wallet page is the first operational checkpoint and must load within five seconds under normal browser conditions.

#### Features

- Connect TronLink button
- Connected wallet address display
- TRX balance display
- USDT balance display
- Deposit QR for wallet address
- Estimated energy requirement for pending batch
- Current network indication with TRON Mainnet emphasis
- Wallet readiness indicators for bandwidth and balance sufficiency

#### Requirements

- Detect `window.tronWeb` and TronLink availability
- Prevent payout actions when wallet is disconnected
- Warn when not on TRON Mainnet
- Refresh balances on connect, reconnect, and manual sync

### 6.2 Batch Import

#### Supported Formats

- CSV
- XLSX

#### Expected Input Columns

- Recipient address
- Amount
- Optional memo or reference column for local display only

#### Import Validation Rules

- Base58Check address validation
- Amount precision validation for USDT token decimals
- Duplicate address detection within imported file
- Duplicate row detection by recipient plus amount plus reference where present
- Budget validation against available spendable USDT balance
- Empty-row interception
- Invalid numeric format interception
- Zero or negative amount interception

#### Input Interception Goal

100% of invalid inputs covered by client-side validation before signing starts.

### 6.3 Validation Experience

Users must see a row-level validation result before payout starts.

#### Validation Outputs

- Valid row count
- Invalid row count
- Total payout amount
- Estimated fee and energy impact
- Duplicate summary
- Blocking issues list

#### Required Performance

- Validate 500 imported rows in under three seconds on a typical modern laptop

### 6.4 Batch Lifecycle

#### Batch-Level Lifecycle

- Draft
- Validated
- Paying
- Completed

#### Item-Level State Machine

- Pending
- Signed
- Broadcast
- Confirming
- Success
- Failed

#### State Semantics

- Pending: validated and queued, not yet signed
- Signed: transaction built and user-signed through TronLink
- Broadcast: node accepted broadcast request
- Confirming: transaction detected on-chain, waiting final confirmation policy
- Success: confirmed and receipt finalized
- Failed: terminal failure with error code and retry context

### 6.5 Payout Execution

#### Execution Model

- Configurable concurrent queue with `N` parallel workers
- Sequential state transitions per payout item
- Idempotent resume based on locally persisted item status and transaction identifiers

#### Execution Rules

- Never broadcast the same payout item twice if IndexedDB already contains a terminal success or an in-flight transaction identifier
- Allow retry only for safe non-terminal failure classes
- Maintain audit logs for each state transition and error event

#### Stress Requirement

- Survive 200-transaction stress run with crash and resume behavior without double-spend

### 6.6 Error Handling

The application must normalize operational failures into explicit error codes.

#### Required Error Codes

- `INVALID_ADDRESS`
- `INSUFFICIENT_BALANCE`
- `INSUFFICIENT_ENERGY`
- `INSUFFICIENT_BANDWIDTH`
- `NODE_TIMEOUT`
- `BROADCAST_REJECTED`
- `CONFIRM_TIMEOUT`

#### Error UX

- Display human-readable reason
- Show retry recommendation where safe
- Mark terminal versus retryable failures
- Include error code in export and audit log

### 6.7 Watch and Confirmation

After broadcast, the watcher must track transaction status until success or terminal timeout.

#### Requirements

- Poll or subscribe to transaction confirmation state
- Persist watcher checkpoints locally
- Resume monitoring after reload
- Generate receipt within five seconds after confirmation under normal browser conditions

### 6.8 Receipt Generation

Each successful payout must produce a standardized receipt suitable for audit and archive.

#### Required Receipt Fields

- BatchID
- Sender
- Recipient
- MaskedAddr using first six characters, stars, and last four characters
- Amount with `USDT TRC-20`
- Network as `TRON Mainnet`
- TxID with clickable explorer link
- QR code pointing to Tronscan transaction page
- Created and confirmed timestamps with timezone
- Status shown in green as `Success`
- SHA256 checksum

#### Receipt Formats

- PNG
- PDF

### 6.9 Export

#### ZIP Contents

- Batch summary JSON
- Original normalized import CSV
- Success and failure CSV exports
- Generated PNG receipts
- Generated PDF receipts
- Audit trail artifact

#### V1 Principle

ZIP export replaces notifications, email, and bot delivery.

## 7. KPI Targets

- 500 transactions completed in a reasonable time on normal mainnet conditions
- Less than 1% app-originated error rate excluding node or chain failures
- 100% receipt coverage for successful payouts
- 100% invalid input interception before signing

## 8. Acceptance Tests

### 8.1 Wallet

- Wallet page connects through TronLink in under five seconds
- TRX and USDT balances display after connect
- Deposit QR renders correctly

### 8.2 Import and Validation

- 500-row CSV validates in under three seconds
- Base58Check failures are blocked
- Precision and budget issues are surfaced before payout starts

### 8.3 Payout Resilience

- 200-transaction stress run survives a browser crash
- Reload resumes in-flight monitoring and queue execution
- No double-spend occurs for previously broadcast items

### 8.4 Receipt

- Receipt is generated within five seconds after confirmation
- PNG and PDF outputs include all required receipt fields

## 9. Security and Compliance Requirements

- Private keys never leave TronLink
- No server-side signing
- No storage of private keys, mnemonics, or raw secrets
- Sensitive wallet state only stored as minimal local cache
- All batch execution decisions must be auditable through IndexedDB-backed logs

## 10. Product Constraints

- Browser-first architecture
- IndexedDB persistence through Dexie.js
- TRON Mainnet support first
- TronLink required for Mode B execution
- Local-only resilience without backend dependence in V1

## 11. Release Criteria for V1

V1 is releasable when:

- wallet connect flow is stable
- CSV and XLSX import are supported
- required validation rules are implemented
- batch lifecycle and item state machine are persisted locally
- broadcast and watcher flows recover after reload
- receipts generate in both PNG and PDF
- ZIP export is available
- build and lint complete without errors
