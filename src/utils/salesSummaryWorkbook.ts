// Writes the "Menu Performance" sales-summary workbook.
//
// The layout is a faithful port of the reference template
// (SalesSummary_<from>_to_<to>.xlsx): a three-line letterhead, a dark header row,
// then one merged block per day. Inside a day, each item merges its name and
// price down over its payment-method rows, and the day's last row closes the
// block with a heavier bottom rule.
//
//   A          B                 C          D               E         F      G         H
//   Date       Item              Price ($)  Payment method  Qty sold  Gross  Discounts Net
//   01-08-2026 Latte             3.25       Cash            17        55.25  2.23      53.02
//              (merged)          (merged)   QR              41        133.25 5.38      127.87
//
// Gross and Net are written as formulas (Qty x Price, Gross - Discounts) so the
// sheet recalculates if a figure is edited by hand, exactly like the template.

import ExcelJS from 'exceljs'
import type { Alignment, Borders, Fill, Font } from 'exceljs'

/** One payment method's figures for an item on a given day. */
export interface SalesSummaryPaymentRow {
  /** Column D label, e.g. 'Cash' or 'QR'. */
  paymentMethod: string
  quantity: number
  gross: number
  discounts: number
  net: number
}

export interface SalesSummaryItemBlock {
  itemName: string
  /** Blocks are per (item, unit price) so `Gross = Qty x Price` holds exactly. */
  unitPrice: number
  rows: SalesSummaryPaymentRow[]
}

export interface SalesSummaryDay {
  /** Shop-local calendar day, YYYY-MM-DD. */
  date: string
  items: SalesSummaryItemBlock[]
}

export interface SalesSummaryTotals {
  quantity: number
  gross: number
  discounts: number
  net: number
}

export interface SalesSummaryReport {
  startDate: string
  endDate: string
  /** Only days that actually sold something — an empty block would break the merges. */
  days: SalesSummaryDay[]
  totals: SalesSummaryTotals
}

const SHEET_NAME = 'Summary Date'

const COLUMN_WIDTHS = [15, 20, 15, 20, 20, 20, 20, 20]

const HEADERS = [
  'Date',
  'Item',
  'Price ($)',
  'Payment method',
  'Quantity sold',
  'Gross sales ($)',
  'Discounts ($)',
  'Net sales ($)',
]

// The `$` is quoted so Excel treats it as a literal prefix rather than the start
// of a locale token, and it sits directly against the digits.
const FORMAT_MONEY = '"$"#,##0.00'
// Discounts are stored positive -- the Net formula is `Gross - Discounts`, so
// flipping the sign would double-subtract -- and the minus is display-only: a
// literal in the positive section. The third section keeps a zero discount as
// plain `$0.00` rather than a nonsensical `-$0.00`.
const FORMAT_MONEY_DISCOUNT = '-"$"#,##0.00;-"$"#,##0.00;"$"0.00'
const FORMAT_QTY = '#,##0'
const FORMAT_DATE = 'dd-mm-yyyy'

const FONT_TITLE: Partial<Font> = {
  name: 'Arial',
  size: 16,
  bold: true,
  color: { argb: 'FF1F2937' },
}
const FONT_META: Partial<Font> = { name: 'Arial', size: 10, color: { argb: 'FF6B7280' } }
const FONT_HEADER: Partial<Font> = {
  name: 'Arial',
  size: 10,
  bold: true,
  color: { argb: 'FFFFFFFF' },
}
const FONT_ITEM: Partial<Font> = { name: 'Arial', size: 10 }
const FONT_TOTAL: Partial<Font> = { name: 'Arial', size: 10, bold: true }

// Discounts read as money out, so that column alone is tinted red.
const COLOR_DISCOUNT = 'FFB91C1C'
const FONT_DISCOUNT: Partial<Font> = { name: 'Arial', size: 10, color: { argb: COLOR_DISCOUNT } }
const FONT_TOTAL_DISCOUNT: Partial<Font> = { ...FONT_TOTAL, color: { argb: COLOR_DISCOUNT } }

const FILL_HEADER: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
const FILL_TOTAL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }

/**
 * Tinted chips for column D, so a day's Cash and QR rows separate at a glance.
 * Keyed on the lowercased label; anything unmapped (COD, Unknown) stays plain.
 */
const PAYMENT_METHOD_STYLES: Record<string, { fill: Fill; font: Partial<Font> }> = {
  cash: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
    font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF166534' } },
  },
  qr: {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } },
    font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E40AF' } },
  },
}

const GRID = { style: 'thin', color: { argb: 'FFD1D5DB' } } as const
/** Heavier rule that closes a day's block. */
const DAY_RULE = { style: 'medium', color: { argb: 'FF9CA3AF' } } as const

const BORDER_BOXED: Partial<Borders> = { top: GRID, left: GRID, bottom: GRID, right: GRID }
/** First row of a multi-row group: no bottom rule, so the group reads as one cell. */
const BORDER_GROUP_TOP: Partial<Borders> = { top: GRID, left: GRID, right: GRID }
const BORDER_GROUP_BODY: Partial<Borders> = { left: GRID, right: GRID, bottom: GRID }
const BORDER_DAY_END: Partial<Borders> = { top: GRID, left: GRID, bottom: DAY_RULE, right: GRID }
const BORDER_GROUP_DAY_END: Partial<Borders> = { left: GRID, right: GRID, bottom: DAY_RULE }

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** 'YYYY-MM-DD' as a UTC-midnight Date, which Excel stores as a whole day serial. */
const toUtcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`)

const formatLongDate = (isoDate: string) => LONG_DATE.format(toUtcDate(isoDate))

/** '01 Aug 2026 – 07 Aug 2026', collapsed to a single date for a one-day export. */
const formatPeriod = (startDate: string, endDate: string) =>
  startDate === endDate
    ? formatLongDate(startDate)
    : `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`

export interface SalesSummaryWorkbookMeta {
  shopName: string
  /** Stamped into the letterhead's "Generated ..." line. */
  generatedAt: Date
}

export const buildSalesSummaryWorkbook = (
  report: SalesSummaryReport,
  meta: SalesSummaryWorkbookMeta
): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = meta.shopName
  workbook.created = meta.generatedAt

  // ExcelJS drops any column width equal to its own default (9) as redundant, so
  // the sheet default carries "Qty sold" — otherwise that one column would fall
  // back to Excel's narrower 8.43.
  const sheet = workbook.addWorksheet(SHEET_NAME, { properties: { defaultColWidth: 9 } })
  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })

  // ── Letterhead ────────────────────────────────────────────────────────────
  // Each line spans the full table so it centres over the data rather than over
  // column A alone. Row 1 gets extra height to give the 16pt title some air.
  const lastColumn = HEADERS.length
  const CENTERED: Partial<Alignment> = { horizontal: 'center', vertical: 'middle' }

  sheet.mergeCellsWithoutStyle(1, 1, 1, lastColumn)
  const title = sheet.getCell('A1')
  title.value = meta.shopName
  title.font = FONT_TITLE
  title.alignment = CENTERED
  sheet.getRow(1).height = 34

  sheet.mergeCellsWithoutStyle(2, 1, 2, lastColumn)
  const period = sheet.getCell('A2')
  period.value = `${SHEET_NAME}  |  ${formatPeriod(report.startDate, report.endDate)}`
  period.font = FONT_META
  period.alignment = CENTERED
  sheet.getRow(2).height = 16

  sheet.mergeCellsWithoutStyle(3, 1, 3, lastColumn)
  const generated = sheet.getCell('A3')
  generated.value = `Generated ${LONG_DATE.format(meta.generatedAt)} ·  Currency: USD`
  generated.font = FONT_META
  generated.alignment = CENTERED
  sheet.getRow(3).height = 16

  // ── Column headers (row 4 stays blank, as in the template) ────────────────
  const headerRowNumber = 5
  HEADERS.forEach((label, index) => {
    const cell = sheet.getRow(headerRowNumber).getCell(index + 1)
    cell.value = label
    cell.font = FONT_HEADER
    cell.fill = FILL_HEADER
    cell.border = BORDER_BOXED
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // ── One block per day ─────────────────────────────────────────────────────
  const firstDataRow = headerRowNumber + 1
  let rowNumber = firstDataRow

  for (const day of report.days) {
    const dayStartRow = rowNumber
    const dayRowCount = day.items.reduce((count, item) => count + item.rows.length, 0)
    const dayEndRow = dayStartRow + dayRowCount - 1

    for (const item of day.items) {
      const itemStartRow = rowNumber
      const itemEndRow = itemStartRow + item.rows.length - 1

      item.rows.forEach((paymentRow, index) => {
        const row = sheet.getRow(rowNumber)
        const isLastRowOfDay = rowNumber === dayEndRow
        const isFirstRowOfItem = index === 0

        // D–H carry a row each, so their borders open downward inside an item
        // group and close on the day's final row.
        const rowBorder = isFirstRowOfItem
          ? isLastRowOfDay
            ? BORDER_DAY_END
            : BORDER_GROUP_TOP
          : isLastRowOfDay
            ? BORDER_GROUP_DAY_END
            : BORDER_GROUP_BODY

        const method = row.getCell(4)
        method.value = paymentRow.paymentMethod
        method.border = rowBorder
        method.alignment = { horizontal: 'center' }

        const methodStyle = PAYMENT_METHOD_STYLES[paymentRow.paymentMethod.trim().toLowerCase()]
        method.font = methodStyle?.font ?? FONT_ITEM
        if (methodStyle) method.fill = methodStyle.fill

        const quantity = row.getCell(5)
        quantity.value = paymentRow.quantity
        quantity.numFmt = FORMAT_QTY
        quantity.border = rowBorder
        quantity.alignment = { horizontal: 'right' }

        const gross = row.getCell(6)
        gross.value = {
          formula: `E${rowNumber}*C${itemStartRow}`,
          result: paymentRow.gross,
          date1904: false,
        }
        gross.numFmt = FORMAT_MONEY
        gross.font = FONT_ITEM
        gross.border = rowBorder
        gross.alignment = { horizontal: 'right' }

        const discounts = row.getCell(7)
        discounts.value = paymentRow.discounts
        discounts.numFmt = FORMAT_MONEY_DISCOUNT
        discounts.font = FONT_DISCOUNT
        discounts.border = rowBorder
        discounts.alignment = { horizontal: 'right' }

        const net = row.getCell(8)
        net.value = {
          formula: `F${rowNumber}-G${rowNumber}`,
          result: paymentRow.net,
          date1904: false,
        }
        net.numFmt = FORMAT_MONEY
        net.font = FONT_ITEM
        net.border = rowBorder
        net.alignment = { horizontal: 'right' }

        // A–C are merged over their group, so every constituent cell is styled:
        // Excel draws a merged block's outline from the cells on its perimeter.
        const groupBorder = isLastRowOfDay ? BORDER_DAY_END : BORDER_BOXED

        const date = row.getCell(1)
        if (rowNumber === dayStartRow) date.value = toUtcDate(day.date)
        date.numFmt = FORMAT_DATE
        date.border = groupBorder
        date.alignment = { horizontal: 'center', vertical: 'middle' }

        const name = row.getCell(2)
        if (isFirstRowOfItem) name.value = item.itemName
        name.font = FONT_ITEM
        name.border = groupBorder
        name.alignment = { horizontal: 'left', vertical: 'middle' }

        const price = row.getCell(3)
        if (isFirstRowOfItem) price.value = item.unitPrice
        price.numFmt = FORMAT_MONEY
        price.border = groupBorder
        price.alignment = { horizontal: 'right', vertical: 'middle' }

        rowNumber += 1
      })

      if (itemEndRow > itemStartRow) {
        sheet.mergeCellsWithoutStyle(itemStartRow, 2, itemEndRow, 2)
        sheet.mergeCellsWithoutStyle(itemStartRow, 3, itemEndRow, 3)
      }
    }

    if (dayEndRow > dayStartRow) {
      sheet.mergeCellsWithoutStyle(dayStartRow, 1, dayEndRow, 1)
    }
  }

  // ── Total row ─────────────────────────────────────────────────────────────
  const lastDataRow = rowNumber - 1
  const hasRows = lastDataRow >= firstDataRow
  const totalRow = sheet.getRow(rowNumber)

  for (let column = 1; column <= 4; column += 1) {
    const cell = totalRow.getCell(column)
    cell.font = FONT_TOTAL
    cell.fill = FILL_TOTAL
    cell.border = BORDER_BOXED
  }
  totalRow.getCell(2).value = 'Total'

  const totalCells: [number, string, number, string, Partial<Font>][] = [
    [5, 'E', report.totals.quantity, FORMAT_QTY, FONT_TOTAL],
    [6, 'F', report.totals.gross, FORMAT_MONEY, FONT_TOTAL],
    [7, 'G', report.totals.discounts, FORMAT_MONEY_DISCOUNT, FONT_TOTAL_DISCOUNT],
    [8, 'H', report.totals.net, FORMAT_MONEY, FONT_TOTAL],
  ]

  for (const [column, letter, value, format, font] of totalCells) {
    const cell = totalRow.getCell(column)
    cell.value = hasRows
      ? {
          formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`,
          result: value,
          date1904: false,
        }
      : value
    cell.numFmt = format
    cell.font = font
    cell.fill = FILL_TOTAL
    cell.border = BORDER_BOXED
    cell.alignment = { horizontal: 'right' }
  }

  return workbook
}

export const salesSummaryFileName = (startDate: string, endDate: string) =>
  `SalesSummary_${startDate}_to_${endDate}.xlsx`

/**
 * Renders the workbook to bytes, ready for the controller to stream as an
 * attachment.
 */
export const renderSalesSummaryWorkbook = async (
  report: SalesSummaryReport,
  meta: SalesSummaryWorkbookMeta
): Promise<Buffer> => {
  const workbook = buildSalesSummaryWorkbook(report, meta)
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
