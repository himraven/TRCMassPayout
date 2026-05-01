import type {
  ImportedBatchDraft,
  ImportValidationError,
  ValidationResult,
  ValidationRowResult,
  WalletBalance,
} from '../../types'
import {
  buildValidationError,
  estimateTrxCost,
  formatSunToTrx,
  isValidTronAddress,
} from '../../utils/tron'

function normalizeAmount(value: string) {
  return value.trim()
}

function getRowStatus(errors: ImportValidationError[]): ValidationRowResult['status'] {
  if (
    errors.some(
      (error) =>
        error.code !== 'DUPLICATE_ADDRESS' &&
        !(error.code === 'MISSING_FIELD' && error.field === 'recipient_name'),
    )
  ) {
    return 'error'
  }

  if (errors.length > 0) {
    return 'warning'
  }

  return 'valid'
}

export async function validateImportedBatch(
  input: ImportedBatchDraft,
  walletBalance?: WalletBalance,
): Promise<ValidationResult> {
  const addressMap = new Map<string, number[]>()
  const rowResults: ValidationRowResult[] = []
  const batchErrors: ImportValidationError[] = []
  let totalAmount = 0

  for (const row of input.rows) {
    const rowErrors: ImportValidationError[] = []
    const address = row.address.trim()
    const amount = normalizeAmount(row.amount)

    if (!address) {
      rowErrors.push(
        buildValidationError(row.lineNumber, 'address', 'MISSING_FIELD', 'Address is required'),
      )
    } else if (!(await isValidTronAddress(address))) {
      rowErrors.push(
        buildValidationError(
          row.lineNumber,
          'address',
          'INVALID_ADDRESS',
          'TRON address must be valid Base58Check with T prefix and checksum',
        ),
      )
    }

    if (!amount) {
      rowErrors.push(
        buildValidationError(row.lineNumber, 'amount', 'MISSING_FIELD', 'Amount is required'),
      )
    } else if (/[eE]/.test(amount)) {
      rowErrors.push(
        buildValidationError(
          row.lineNumber,
          'amount',
          'INVALID_AMOUNT',
          'Scientific notation is not supported',
        ),
      )
    } else if (!/^\d+(\.\d+)?$/.test(amount)) {
      rowErrors.push(
        buildValidationError(
          row.lineNumber,
          'amount',
          'INVALID_AMOUNT',
          'Amount must be a positive decimal number',
        ),
      )
    } else {
      const [, fraction = ''] = amount.split('.')
      const amountNumber = Number(amount)

      if (fraction.length > 6) {
        rowErrors.push(
          buildValidationError(
            row.lineNumber,
            'amount',
            'PRECISION_EXCEEDED',
            'USDT amount supports up to 6 decimal places',
          ),
        )
      } else if (amountNumber <= 0) {
        rowErrors.push(
          buildValidationError(
            row.lineNumber,
            'amount',
            'INVALID_AMOUNT',
            'Amount must be greater than zero',
          ),
        )
      } else {
        totalAmount += amountNumber
      }
    }

    if (!row.recipientName.trim()) {
      rowErrors.push(
        buildValidationError(
          row.lineNumber,
          'recipient_name',
          'MISSING_FIELD',
          'Recipient name is recommended for reconciliation',
        ),
      )
    }

    if (address) {
      const rows = addressMap.get(address) ?? []
      rows.push(row.lineNumber)
      addressMap.set(address, rows)
    }

    rowResults.push({
      rowNumber: row.lineNumber,
      status: getRowStatus(rowErrors),
      errors: rowErrors,
      item: row,
    })
  }

  for (const result of rowResults) {
    const duplicates = addressMap.get(result.item.address.trim())
    if (duplicates && duplicates.length > 1) {
      result.errors.push(
        buildValidationError(
          result.rowNumber,
          'address',
          'DUPLICATE_ADDRESS',
          `Duplicate address also appears on rows ${duplicates.join(', ')}`,
        ),
      )
      result.status = getRowStatus(result.errors)
    }
  }

  const estimatedTrxCost = estimateTrxCost(input.rows.length)
  if (walletBalance) {
    if (totalAmount > Number(walletBalance.usdtBalance)) {
      batchErrors.push(
        buildValidationError(
          0,
          'batch',
          'BUDGET_EXCEEDED',
          `USDT balance ${walletBalance.usdtBalance} is below required ${totalAmount.toFixed(6)}`,
        ),
      )
    }

    if (Number(formatSunToTrx(walletBalance.trxBalanceSun)) < Number(estimatedTrxCost)) {
      batchErrors.push(
        buildValidationError(
          0,
          'batch',
          'BUDGET_EXCEEDED',
          `Estimated TRX fee ${estimatedTrxCost} exceeds available ${formatSunToTrx(walletBalance.trxBalanceSun)}`,
        ),
      )
    }
  }

  const allErrors = [...rowResults.flatMap((result) => result.errors), ...batchErrors]

  return {
    rows: rowResults,
    totalRows: input.rows.length,
    validCount: rowResults.filter((result) => result.status === 'valid').length,
    warningCount:
      rowResults.filter((result) => result.status === 'warning').length + batchErrors.length,
    errorCount: rowResults.filter((result) => result.status === 'error').length,
    totalAmount: totalAmount.toFixed(6),
    estimatedTrxCost,
    errors: allErrors,
  }
}