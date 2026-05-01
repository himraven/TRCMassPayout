import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type {
  IImporterService,
  ImportedBatchDraft,
  ValidationResult,
  WalletBalance,
} from '../../types'
import type { ImportValidationError, ImportedBatchRow } from '../../types'
import { sanitizeUserText } from '../../utils/sanitize'
import { validateImportedBatch } from './validator'

const COLUMN_ALIASES: Record<
  keyof ImportedBatchDraft['columnMap'],
  string[]
> = {
  recipientName: [
    'recipient_name',
    'recipient',
    'name',
    'beneficiary',
    '收款人',
    '姓名',
  ],
  address: ['address', 'addr', 'wallet', 'wallet_address', 'tron_address', '地址'],
  amount: ['amount', 'usdt', '金额', '数量', 'value'],
  contactEmail: ['contact_email', 'email', 'mail', '邮箱'],
  contactTelegram: ['contact_telegram', 'telegram', 'tg', 'telegram_handle', '电报'],
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function detectDelimiter(text: string) {
  const sample = text.slice(0, 2048)
  const delimiters = [',', ';', '\t', '|']
  return (
    delimiters
      .map((delimiter) => ({
        delimiter,
        score: sample.split('\n').slice(0, 5).reduce((count, line) => {
          return count + line.split(delimiter).length
        }, 0),
      }))
      .sort((left, right) => right.score - left.score)[0]?.delimiter ?? ','
  )
}

function detectColumns(headers: string[]) {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }))

  const findMatch = (aliases: string[]) =>
    normalizedHeaders.find((header) =>
      aliases.some((alias) => header.normalized === normalizeHeader(alias)),
    )?.original ?? null

  return {
    recipientName: findMatch(COLUMN_ALIASES.recipientName),
    address: findMatch(COLUMN_ALIASES.address),
    amount: findMatch(COLUMN_ALIASES.amount),
    contactEmail: findMatch(COLUMN_ALIASES.contactEmail),
    contactTelegram: findMatch(COLUMN_ALIASES.contactTelegram),
  }
}

function mapRows(
  rawRows: Record<string, unknown>[],
  columnMap: ImportedBatchDraft['columnMap'],
): ImportedBatchRow[] {
  return rawRows.map((row, index) => {
    const raw = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? '').trim()]),
    )

    return {
      lineNumber: index + 2,
      recipientName: sanitizeUserText(
        columnMap.recipientName ? raw[columnMap.recipientName] ?? '' : '',
        120,
      ),
      address: sanitizeUserText(columnMap.address ? raw[columnMap.address] ?? '' : '', 80),
      amount: sanitizeUserText(columnMap.amount ? raw[columnMap.amount] ?? '' : '', 24),
      contactEmail: columnMap.contactEmail
        ? sanitizeUserText(raw[columnMap.contactEmail] ?? '', 120)
        : '',
      contactTelegram: columnMap.contactTelegram
        ? sanitizeUserText(raw[columnMap.contactTelegram] ?? '', 120)
        : '',
      raw,
    }
  })
}

export class ImporterService implements IImporterService {
  private errors: ImportValidationError[] = []

  async parseFile(file: File): Promise<ImportedBatchDraft> {
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (extension === 'csv') {
      const text = (await file.text()).replace(/^\uFEFF/, '')
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: detectDelimiter(text),
        transformHeader: (header) => header.trim(),
      })
      const headers = parsed.meta.fields ?? []
      const columnMap = detectColumns(headers)

      return {
        fileName: file.name,
        fileType: 'csv',
        columnMap,
        rows: mapRows(parsed.data, columnMap),
      }
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const firstSheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    })
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    const columnMap = detectColumns(headers)

    return {
      fileName: file.name,
      fileType: 'xlsx',
      columnMap,
      rows: mapRows(rows, columnMap),
    }
  }

  async validateBatch(
    input: ImportedBatchDraft,
    walletBalance?: WalletBalance,
  ): Promise<ValidationResult> {
    const result = await validateImportedBatch(input, walletBalance)
    this.errors = result.errors
    return result
  }

  getErrors() {
    return this.errors
  }
}

export const importerService = new ImporterService()