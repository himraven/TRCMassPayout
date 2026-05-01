# TRC-20 Batch Payout Manual Testing Guide

## Prerequisites

1. Install Chrome or Firefox with the TronLink extension.
2. Configure TronLink to the Nile testnet.
3. Fund the wallet with test TRX from `https://nileex.io/join/getJoinPage`.
4. Use the Nile USDT test contract `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`.
5. Start the app locally with `npm run dev`.

## Test data

- Valid sample batch: `docs/test-data/sample-batch-10.csv`
- Invalid sample batch: `docs/test-data/sample-batch-errors.csv`

## 1. Wallet connection

1. Open the app in the browser.
2. Click the wallet connect action and approve the TronLink prompt.
3. Verify the connected address is shown in the UI.
4. Verify the TRX and USDT balances load and display.
5. Disconnect the wallet, then reconnect it.
6. Switch to another TronLink account and verify the address and balances refresh.

## 2. Import and validation

1. Open the import flow.
2. Upload `docs/test-data/sample-batch-10.csv`.
3. Verify all 10 rows validate successfully and show green/valid status.
4. Verify the estimated total amount and fee summary are displayed.
5. Upload `docs/test-data/sample-batch-errors.csv`.
6. Verify row-level validation errors are shown for:
   - invalid address
   - amount with 7 decimals
   - missing amount
   - duplicate address warning
   - missing recipient name warning if surfaced by the UI

## 3. Batch execution

1. Create a batch from the valid import file.
2. Start the payout run.
3. Approve TronLink signing popups as they appear.
4. Verify item statuses move through signing, broadcast, confirming, and success.
5. Verify the batch summary updates in real time until all items complete.

## 4. Crash recovery

1. Prepare a 5-transaction batch and start execution.
2. Wait until at least 2 transactions reach confirmation.
3. Close the browser tab without pausing the batch.
4. Reopen the app.
5. Verify the in-progress batch reloads.
6. Verify previously broadcast transactions resume in confirming state.
7. Verify unfinished signing transactions are reset and can continue.

## 5. Receipt and export

1. After the batch completes, open the receipt section.
2. Preview a generated receipt and verify:
   - batch ID
   - transaction hash
   - amount
   - recipient
   - sender
   - checksum
   - QR code
3. Download the ZIP export and verify receipt files are included.
4. Download the CSV export and verify transaction and status columns are populated.

## Expected outcome

- Wallet state tracks TronLink changes reliably.
- Valid imports pass and invalid rows surface clear validation feedback.
- Batch execution completes with visible status transitions.
- Recovery resumes watchable transactions after an interrupted session.
- Receipt preview and exports contain complete, usable payout data.