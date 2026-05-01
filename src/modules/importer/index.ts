import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type {
  IImporterService,
  ImportedBatchDraft,
  ImportValidationError,
  ValidationResult,
  WalletBalance,
} from '../../types'
import {
  buildValidationError,
  isUsdtPrecisionValid,
  looksLikeTronAddress,
} from '../../utils/tron'

export class ImporterService implements IImporterService {
  private errors: ImportValidationError[] = []

  async parseFile(file: File): Promise<ImportedBatchDraft> {
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (extension === 'csv') {
      const text = await file.text()
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      })

      const rows = parsed.data.map((row, index) => ({
        lineNumber: index + 2,
        recipient: row.recipient ?? row.address ?? '',
        amount: row.amount ?? '',
        reference: row.reference ?? row.memo ?? '',
      }))

      return { fileName: file.name, rows }
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils
      .sheet_to_json<Record<string, string>>(sheet)
      .map((row, index) => ({
        lineNumber: index + 2,
        recipient: row.recipient ?? row.address ?? '',
        amount: row.amount ?? '',
        reference: row.reference ?? row.memo ?? '',
      }))

    return { fileName: file.name, rows }
  }

  async validateBatch(
    input: ImportedBatchDraft,
    walletBalance?: WalletBalance,
  ): Promise<ValidationResult> {
    const duplicates = new Set<string>()
    const seen = new Set<string>()

    this.errors = input.rows.flatMap((row) => {
      const rowErrors: ImportValidationError[] = []
      const duplicateKey = `${row.recipient}:${row.amount}:${row.reference}`

      if (!looksLikeTronAddress(row.recipient)) {
        rowErrors.push(buildValidationError(row.lineNumber, 'INVALID_ADDRESS'))
      }

      if (!isUsdtPrecisionValid(row.amount)) {
        rowErrors.push(
          buildValidationError(
            row.lineNumber,
            'INVALID_AMOUNT',
            'USDT supports up to 6 decimals',
          ),
        )
      }

      if (seen.has(duplicateKey)) {
        duplicates.add(duplicateKey)
        rowErrors.push(
          buildValidationError(
            row.lineNumber,
            'DUPLICATE_ROW',
            'Recipient, amount, and reference must be unique',
          ),
        )
      }

      seen.add(duplicateKey)

      return rowErrors
    })

    const totalAmount = input.rows.reduce((sum, row) => sum + Number(row.amount), 0)

    if (walletBalance && totalAmount > Number(walletBalance.usdtBalance)) {
      this.errors.push(
        buildValidationError(
          0,
          'BUDGET_EXCEEDED',
          'Available USDT balance is lower than the batch total',
        ),
      )
    }

    return {
      validRows: input.rows.length - this.errors.length,
      invalidRows: this.errors.length,
      totalAmount: totalAmount.toFixed(6),
      duplicates: duplicates.size,
      errors: this.errors,
    }
  }

  getErrors() {
    return this.errors
  }
}

export const importerService = new ImporterService()