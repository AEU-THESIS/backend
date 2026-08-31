// Builds the two inventory workbooks the API streams to the client:
// the Expense Report and a single item's Stock History.
//
// Both follow the same shell (banner, KPI cards, an embedded chart image, then
// the detail table) from `excelReportTemplate`, so they read as one family of
// reports. Once the selected range spans more than one calendar month, the
// detail table moves off the main sheet into one sheet per month: a single flat
// table for a year of restocking is unwieldy, while per-month sheets stay easy
// to page through. A short range keeps the table inline.
//
// This is a port of the workbook code the client used to run in the browser —
// the generated files are meant to be indistinguishable from the ones it
// produced.

import ExcelJS from 'exceljs'
import {
  EXCEL_MAX_ROWS_PER_SHEET,
  chunkSheetName,
  excelHeaderCellStyle,
  groupByMonth,
  shouldSplitByMonth,
  writeExcelBanner,
  writeExcelFooter,
  writeExcelKpiRow,
  writeExcelNote,
  writeExcelSectionHeading,
  type ExcelKpiBlock,
} from './excelReportTemplate'
import { renderBarChartPng, type BarChartPoint } from './barChartImage'
import { interpolate, type InventoryExportLabels } from '../constants/inventoryExportLabels'

const WORKBOOK_CREATOR = 'RoutinCafe POS'
const CHART_IMAGE_SIZE = { width: 560, height: 236 }
/** Rows the embedded chart picture covers, so the table starts below it. */
const CHART_IMAGE_ROWS = 15
/** The banner, KPI cards, headings and footer all span this many columns. */
const REPORT_WIDTH = 6

const round2 = (value: number) => Math.round(value * 100) / 100

// ExcelJS embeds a picture from either raw bytes or a data URL; the typings only
// accept its own Buffer flavour, so the data URL is the friction-free route.
const pngDataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`

/** Locale- and shop-dependent formatting, resolved once by the caller. */
export interface ExportFormatters {
  /** The shop's money-display rule, e.g. `$12.50` or `៛51,250`. */
  money: (amount: number) => string
  number: (value: number) => string
  dateTime: (date: Date) => string
}

// ---------------------------------------------------------------------------
// Expense Report
// ---------------------------------------------------------------------------

export interface ExpenseRecordRow {
  /** Shop-local calendar day, `YYYY-MM-DD`. */
  date: string
  name: string
  unitOfMeasure: string
  quantity: number
  unitCost: number
  totalCost: number
}

export interface ExpenseReportWorkbookData {
  records: ExpenseRecordRow[]
  /** Daily spend, already bucketed by the shop's own calendar. */
  chartPoints: BarChartPoint[]
  totalSpend: number
  purchaseCount: number
  /** `YYYY-MM-DD` bounds as shown in the banner and the file name. */
  startLabel: string
  endLabel: string
  currency: string
  labels: InventoryExportLabels
}

const RECORD_TABLE_COLUMNS = [
  { width: 14 },
  { width: 24 },
  { width: 12 },
  { width: 14 },
  { width: 14 },
]

// Writes the header/rows/Total-row for a table starting at `startRow` on
// `targetSheet`, with autofilter over the header. Reused for both the inline
// (single-month) case and each per-month sheet.
const writeRecordsTable = (
  targetSheet: ExcelJS.Worksheet,
  startRow: number,
  rows: ExpenseRecordRow[],
  moneyFormat: string,
  headers: string[],
  totalRowLabel: string
) => {
  const headerRow = targetSheet.getRow(startRow)
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = label
    excelHeaderCellStyle(cell, idx >= 2 ? 'right' : 'left')
  })
  targetSheet.autoFilter = {
    from: { row: startRow, column: 1 },
    to: { row: startRow, column: headers.length },
  }

  rows.forEach((record, idx) => {
    const row = targetSheet.getRow(startRow + 1 + idx)
    row.getCell(1).value = record.date
    row.getCell(2).value = record.name
    row.getCell(3).value = `${record.quantity} ${record.unitOfMeasure}`
    row.getCell(3).alignment = { horizontal: 'right' }
    row.getCell(4).value = record.unitCost
    row.getCell(4).numFmt = moneyFormat
    row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(5).value = record.totalCost
    row.getCell(5).numFmt = moneyFormat
    row.getCell(5).alignment = { horizontal: 'right' }
  })

  const totalRowIndex = startRow + 1 + rows.length
  const totalRow = targetSheet.getRow(totalRowIndex)
  totalRow.getCell(1).value = totalRowLabel
  totalRow.getCell(1).font = { bold: true }
  const sum = rows.reduce((acc, r) => acc + r.totalCost, 0)
  totalRow.getCell(5).value = round2(sum)
  totalRow.getCell(5).font = { bold: true }
  totalRow.getCell(5).numFmt = moneyFormat
  totalRow.getCell(5).alignment = { horizontal: 'right' }

  return totalRowIndex + 1
}

export const renderExpenseReportWorkbook = async (
  data: ExpenseReportWorkbookData
): Promise<Buffer> => {
  const { labels, currency, startLabel, endLabel, records } = data
  const copy = labels.expenseReport
  const workbook = new ExcelJS.Workbook()
  workbook.creator = WORKBOOK_CREATOR

  const moneyFormat = `"${currency}"#,##0.00`
  const averagePurchase = data.purchaseCount > 0 ? data.totalSpend / data.purchaseCount : 0

  const sheet = workbook.addWorksheet(copy.title)
  sheet.columns = [
    { width: 16 },
    { width: 22 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 10 },
  ]

  let cursor = writeExcelBanner(
    sheet,
    1,
    REPORT_WIDTH,
    copy.title,
    copy.subtitle,
    interpolate(copy.filterLine, {
      start: startLabel,
      end: endLabel,
      item: copy.allItems,
      groupBy: copy.groupByDay,
      currency,
    })
  )

  const kpiBlocks: ExcelKpiBlock[] = [
    {
      from: 1,
      to: 2,
      header: copy.kpiTotalSpend,
      value: data.totalSpend,
      numFmt: moneyFormat,
      caption: interpolate(copy.kpiTotalSpendCaption, { count: data.purchaseCount }),
    },
    {
      from: 3,
      to: 4,
      header: copy.kpiTransactions,
      value: data.purchaseCount,
      caption: copy.kpiTransactionsCaption,
    },
    {
      from: 5,
      to: 6,
      header: copy.kpiAverage,
      value: round2(averagePurchase),
      numFmt: moneyFormat,
      caption: copy.kpiAverageCaption,
    },
  ]
  cursor = writeExcelKpiRow(sheet, cursor, kpiBlocks)

  // --- Spend Over Time: embedded chart image ---
  cursor = writeExcelSectionHeading(sheet, cursor, REPORT_WIDTH, copy.chartTitle)
  if (data.chartPoints.length > 0) {
    const chartPng = await renderBarChartPng(data.chartPoints, {
      title: copy.chartLabel,
      valuePrefix: currency,
    })
    const imageId = workbook.addImage({ base64: pngDataUrl(chartPng), extension: 'png' })
    sheet.addImage(imageId, { tl: { col: 0, row: cursor - 1 }, ext: CHART_IMAGE_SIZE })
    cursor += CHART_IMAGE_ROWS
  }
  cursor += 1

  // --- Purchase History: inline if it's one month, per-month sheets otherwise ---
  cursor = writeExcelSectionHeading(sheet, cursor, REPORT_WIDTH, copy.purchaseHistory)
  const monthGroups = groupByMonth(records, record => record.date, labels.monthsShort)
  const tableHeaders = [
    copy.tableDate,
    copy.tableItem,
    copy.tableQuantity,
    copy.tableUnitCost,
    copy.tableTotal,
  ]

  if (!shouldSplitByMonth(monthGroups.length, records.length)) {
    cursor = writeRecordsTable(sheet, cursor, records, moneyFormat, tableHeaders, copy.totalRow)
    cursor += 1
  } else {
    cursor = writeExcelNote(sheet, cursor, REPORT_WIDTH, copy.multiMonthNote)
    cursor += 1

    for (const month of monthGroups) {
      if (month.items.length <= EXCEL_MAX_ROWS_PER_SHEET) {
        const monthSheet = workbook.addWorksheet(month.label)
        monthSheet.columns = RECORD_TABLE_COLUMNS
        writeRecordsTable(monthSheet, 1, month.items, moneyFormat, tableHeaders, copy.totalRow)
        continue
      }
      for (let start = 0; start < month.items.length; start += EXCEL_MAX_ROWS_PER_SHEET) {
        const chunk = month.items.slice(start, start + EXCEL_MAX_ROWS_PER_SHEET)
        const chunkSheet = workbook.addWorksheet(
          chunkSheetName(month.label, start + 1, start + chunk.length)
        )
        chunkSheet.columns = RECORD_TABLE_COLUMNS
        writeRecordsTable(chunkSheet, 1, chunk, moneyFormat, tableHeaders, copy.totalRow)
      }
    }
  }

  writeExcelFooter(sheet, cursor, REPORT_WIDTH, copy.footerHeading, copy.footerBody)

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export const expenseReportFileName = (startLabel: string, endLabel: string) =>
  `inventory-expense-report_${startLabel}_${endLabel}.xlsx`

// ---------------------------------------------------------------------------
// Stock History (one item)
// ---------------------------------------------------------------------------

export interface StockHistoryRow {
  type: 'add' | 'remove'
  quantityChanged: number
  unitCost: number | null
  /** Quantity x unit cost; null when the movement recorded no unit cost. */
  value: number | null
  notes: string | null
  user: string | null
  createdAt: Date
  /** Shop-local calendar day the movement falls on, `YYYY-MM-DD`. */
  localDate: string
}

export interface StockHistoryWorkbookData {
  item: {
    name: string
    unitOfMeasure: string
    quantity: number
    totalValue: number
    categoryName: string | null
  }
  entries: StockHistoryRow[]
  totals: { totalIn: number; totalOut: number }
  typeFilter: 'all' | 'add' | 'remove'
  startLabel: string
  endLabel: string
  currency: string
  labels: InventoryExportLabels
  format: ExportFormatters
}

const MOVEMENT_TABLE_COLUMNS = [
  { width: 18 },
  { width: 10 },
  { width: 12 },
  { width: 10 },
  { width: 14 },
  { width: 14 },
  { width: 24 },
  { width: 18 },
]

// Writes the header/rows/Total-row for the movement table starting at
// `startRow`, with autofilter over the header. Reused for the inline
// (single-month) case and each per-month sheet. The Total row sums the
// signed Value column — a net money change for the movements on that sheet.
const writeMovementTable = (
  targetSheet: ExcelJS.Worksheet,
  startRow: number,
  rows: StockHistoryRow[],
  unit: string,
  moneyFormat: string,
  headers: string[],
  typeLabels: { add: string; remove: string },
  totalRowLabel: string,
  formatDateTime: (date: Date) => string
) => {
  const headerRow = targetSheet.getRow(startRow)
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = label
    excelHeaderCellStyle(cell, idx >= 2 ? 'right' : 'left')
  })
  targetSheet.autoFilter = {
    from: { row: startRow, column: 1 },
    to: { row: startRow, column: headers.length },
  }

  rows.forEach((entry, idx) => {
    const row = targetSheet.getRow(startRow + 1 + idx)
    const signedValue =
      entry.value === null ? null : entry.type === 'add' ? entry.value : -entry.value
    const values: (string | number)[] = [
      formatDateTime(entry.createdAt),
      entry.type === 'add' ? typeLabels.add : typeLabels.remove,
      entry.quantityChanged,
      unit,
      signedValue ?? '',
      entry.unitCost ?? '',
      entry.notes ?? '',
      entry.user ?? '',
    ]
    values.forEach((value, colIdx) => {
      const cell = row.getCell(colIdx + 1)
      cell.value = value
      if (colIdx === 2) cell.alignment = { horizontal: 'right' }
      if ((colIdx === 4 || colIdx === 5) && value !== '') cell.numFmt = moneyFormat
    })
  })

  const totalRowIndex = startRow + 1 + rows.length
  const totalRow = targetSheet.getRow(totalRowIndex)
  totalRow.getCell(2).value = totalRowLabel
  totalRow.getCell(2).font = { bold: true }
  const sheetTotal = rows.reduce((sum, entry) => {
    if (entry.value === null) return sum
    return sum + (entry.type === 'add' ? entry.value : -entry.value)
  }, 0)
  totalRow.getCell(5).value = round2(sheetTotal)
  totalRow.getCell(5).font = { bold: true }
  totalRow.getCell(5).numFmt = moneyFormat

  return totalRowIndex + 1
}

export const renderStockHistoryWorkbook = async (
  data: StockHistoryWorkbookData
): Promise<Buffer> => {
  const { labels, currency, startLabel, endLabel, entries, item, format } = data
  const copy = labels.stockHistory
  // Every string in this report can name the item, so `item` is always in scope.
  const hx = (template: string, params: Record<string, string | number> = {}) =>
    interpolate(template, { item: item.name, ...params })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = WORKBOOK_CREATOR
  const moneyFormat = `"${currency}"#,##0.00`
  const unit = item.unitOfMeasure

  const sheet = workbook.addWorksheet(copy.sheetName)
  sheet.columns = MOVEMENT_TABLE_COLUMNS

  const typeFilterLabel =
    data.typeFilter === 'all'
      ? copy.filterTypeBoth
      : data.typeFilter === 'add'
        ? copy.filterTypeIn
        : copy.filterTypeOut

  let cursor = writeExcelBanner(
    sheet,
    1,
    REPORT_WIDTH,
    hx(copy.title),
    hx(copy.subtitle),
    hx(copy.filterLine, {
      start: startLabel,
      end: endLabel,
      type: typeFilterLabel,
      unit: unit || '—',
      category: item.categoryName ?? '—',
    })
  )

  const kpiBlocks: ExcelKpiBlock[] = [
    {
      from: 1,
      to: 2,
      header: hx(copy.kpiCurrentStock),
      value: `${format.number(item.quantity)} ${unit}`,
      caption: hx(copy.kpiCurrentStockCaption, { value: format.money(item.totalValue) }),
    },
    {
      from: 3,
      to: 4,
      header: hx(copy.kpiTotalIn),
      value: `${format.number(data.totals.totalIn)} ${unit}`,
      caption: hx(copy.kpiTotalInCaption),
    },
    {
      from: 5,
      to: 6,
      header: hx(copy.kpiTotalOut),
      value: `${format.number(data.totals.totalOut)} ${unit}`,
      caption: hx(copy.kpiTotalOutCaption),
    },
  ]
  cursor = writeExcelKpiRow(sheet, cursor, kpiBlocks)

  // --- Value Over Time: embedded chart image (net signed value per day) ---
  cursor = writeExcelSectionHeading(sheet, cursor, REPORT_WIDTH, hx(copy.chartTitle))
  const dayTotals = new Map<string, number>()
  for (const entry of entries) {
    if (entry.value === null) continue
    const signed = entry.type === 'add' ? entry.value : -entry.value
    dayTotals.set(entry.localDate, (dayTotals.get(entry.localDate) ?? 0) + signed)
  }
  const chartPoints: BarChartPoint[] = [...dayTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      label: `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`,
      value: round2(value),
    }))
  if (chartPoints.length > 0) {
    const chartPng = await renderBarChartPng(chartPoints, {
      title: hx(copy.chartLabel),
      valuePrefix: currency,
    })
    const imageId = workbook.addImage({ base64: pngDataUrl(chartPng), extension: 'png' })
    sheet.addImage(imageId, { tl: { col: 0, row: cursor - 1 }, ext: CHART_IMAGE_SIZE })
    cursor += CHART_IMAGE_ROWS
  }
  cursor += 1

  // --- Movement History: inline if it's one month, per-month sheets otherwise ---
  cursor = writeExcelSectionHeading(sheet, cursor, REPORT_WIDTH, hx(copy.movementHistory))
  const monthGroups = groupByMonth(entries, entry => entry.localDate, labels.monthsShort)
  const tableHeaders = [
    hx(copy.tableDate),
    hx(copy.tableType),
    hx(copy.tableQuantity),
    hx(copy.tableUnit),
    hx(copy.tableValue),
    hx(copy.tableUnitCost),
    hx(copy.tableNotes),
    hx(copy.tableBy),
  ]
  const typeLabels = { add: hx(copy.typeAdd), remove: hx(copy.typeRemove) }
  const totalRowLabel = hx(copy.totalRow)

  if (!shouldSplitByMonth(monthGroups.length, entries.length)) {
    cursor = writeMovementTable(
      sheet,
      cursor,
      entries,
      unit,
      moneyFormat,
      tableHeaders,
      typeLabels,
      totalRowLabel,
      format.dateTime
    )
    cursor += 1
  } else {
    cursor = writeExcelNote(sheet, cursor, REPORT_WIDTH, hx(copy.multiMonthNote))
    cursor += 1

    for (const month of monthGroups) {
      if (month.items.length <= EXCEL_MAX_ROWS_PER_SHEET) {
        const monthSheet = workbook.addWorksheet(month.label)
        monthSheet.columns = MOVEMENT_TABLE_COLUMNS
        writeMovementTable(
          monthSheet,
          1,
          month.items,
          unit,
          moneyFormat,
          tableHeaders,
          typeLabels,
          totalRowLabel,
          format.dateTime
        )
        continue
      }
      for (let start = 0; start < month.items.length; start += EXCEL_MAX_ROWS_PER_SHEET) {
        const chunk = month.items.slice(start, start + EXCEL_MAX_ROWS_PER_SHEET)
        const chunkSheet = workbook.addWorksheet(
          chunkSheetName(month.label, start + 1, start + chunk.length)
        )
        chunkSheet.columns = MOVEMENT_TABLE_COLUMNS
        writeMovementTable(
          chunkSheet,
          1,
          chunk,
          unit,
          moneyFormat,
          tableHeaders,
          typeLabels,
          totalRowLabel,
          format.dateTime
        )
      }
    }
  }

  writeExcelFooter(sheet, cursor, REPORT_WIDTH, hx(copy.footerHeading), hx(copy.footerBody))

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

/** Latin-safe slug of the item name; non-Latin names fall back to `item`. */
const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item'

export const stockHistoryFileName = (itemName: string, startLabel: string, endLabel: string) =>
  `stock-history_${slugify(itemName)}_${startLabel}_${endLabel}.xlsx`
