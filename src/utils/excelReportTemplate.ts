// Shared report shell for every workbook the API streams: banner, KPI row,
// section headings, footer, plus the month-splitting rules a long table uses.
//
// Ported from the client's former `utils/excelExport.ts` when Excel generation
// moved server-side, so the files users download keep the exact same look.

import type ExcelJS from 'exceljs'

export const EXCEL_PRIMARY_ARGB = 'FFB45309'
export const EXCEL_WHITE_ARGB = 'FFFFFFFF'
export const EXCEL_GREY_ARGB = 'FF737373'
export const EXCEL_FOOTER_FILL_ARGB = 'FFFDF2F0'

export const excelHeaderCellStyle = (cell: ExcelJS.Cell, align: 'left' | 'right' = 'left') => {
  cell.font = { bold: true, color: { argb: EXCEL_WHITE_ARGB } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_PRIMARY_ARGB } }
  cell.alignment = { horizontal: align, vertical: 'middle' }
}

/** Writes the title/subtitle/filter-info banner starting at `startRow`; returns the next free row. */
export const writeExcelBanner = (
  sheet: ExcelJS.Worksheet,
  startRow: number,
  totalCols: number,
  title: string,
  subtitle: string,
  filterLine: string
): number => {
  let cursor = startRow
  const fullWidthRow = (text: string, font: Partial<ExcelJS.Font>, fill?: ExcelJS.Fill) => {
    const row = sheet.getRow(cursor)
    for (let col = 1; col <= totalCols; col++) {
      const cell = row.getCell(col)
      cell.value = text
      cell.font = font
      if (fill) {
        cell.fill = fill
        cell.alignment = { vertical: 'middle' }
      }
    }
    sheet.mergeCells(cursor, 1, cursor, totalCols)
    cursor += 1
  }

  fullWidthRow(
    title,
    { bold: true, size: 16, color: { argb: EXCEL_WHITE_ARGB } },
    {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_PRIMARY_ARGB },
    }
  )
  fullWidthRow(subtitle, { italic: true, color: { argb: EXCEL_GREY_ARGB } })
  cursor += 1
  fullWidthRow(filterLine, { bold: true })
  cursor += 1
  return cursor
}

/** A single KPI card spanning columns `from`..`to` (inclusive, 1-indexed). */
export interface ExcelKpiBlock {
  from: number
  to: number
  header: string
  value: number | string
  numFmt?: string
  caption: string
}

/** Writes a row of KPI cards (header/value/caption, 3 rows tall); returns the next free row. */
export const writeExcelKpiRow = (
  sheet: ExcelJS.Worksheet,
  startRow: number,
  blocks: ExcelKpiBlock[]
): number => {
  const headerRow = startRow
  const valueRow = startRow + 1
  const captionRow = startRow + 2

  for (const block of blocks) {
    const headerCell = sheet.getRow(headerRow).getCell(block.from)
    headerCell.value = block.header
    headerCell.font = { bold: true, size: 9, color: { argb: EXCEL_GREY_ARGB } }
    sheet.mergeCells(headerRow, block.from, headerRow, block.to)

    const valueCell = sheet.getRow(valueRow).getCell(block.from)
    valueCell.value = block.value
    valueCell.font = { bold: true, size: 16, color: { argb: EXCEL_PRIMARY_ARGB } }
    if (block.numFmt) valueCell.numFmt = block.numFmt
    sheet.mergeCells(valueRow, block.from, valueRow, block.to)

    const captionCell = sheet.getRow(captionRow).getCell(block.from)
    captionCell.value = block.caption
    captionCell.font = { size: 9, color: { argb: EXCEL_GREY_ARGB } }
    sheet.mergeCells(captionRow, block.from, captionRow, block.to)
  }

  return captionRow + 2
}

/** A single bold section heading (e.g. "Purchase History"); returns the next free row. */
export const writeExcelSectionHeading = (
  sheet: ExcelJS.Worksheet,
  startRow: number,
  totalCols: number,
  text: string
): number => {
  const row = sheet.getRow(startRow)
  for (let col = 1; col <= totalCols; col++) {
    const cell = row.getCell(col)
    cell.value = text
    cell.font = { bold: true, size: 12 }
  }
  sheet.mergeCells(startRow, 1, startRow, totalCols)
  return startRow + 1
}

/** A plain italic note row (e.g. pointing to per-month sheets); returns the next free row. */
export const writeExcelNote = (
  sheet: ExcelJS.Worksheet,
  startRow: number,
  totalCols: number,
  text: string
): number => {
  const row = sheet.getRow(startRow)
  for (let col = 1; col <= totalCols; col++) {
    const cell = row.getCell(col)
    cell.value = text
    cell.font = { italic: true, color: { argb: EXCEL_GREY_ARGB } }
  }
  sheet.mergeCells(startRow, 1, startRow, totalCols)
  return startRow + 1
}

/** The peach "report scope" disclaimer box every report ends with. */
export const writeExcelFooter = (
  sheet: ExcelJS.Worksheet,
  startRow: number,
  totalCols: number,
  heading: string,
  body: string
): void => {
  const fill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_FOOTER_FILL_ARGB },
  }

  const headingRow = sheet.getRow(startRow)
  for (let col = 1; col <= totalCols; col++) headingRow.getCell(col).fill = fill
  headingRow.getCell(1).value = heading
  headingRow.getCell(1).font = { bold: true, color: { argb: EXCEL_PRIMARY_ARGB } }
  sheet.mergeCells(startRow, 1, startRow, totalCols)

  const bodyRow = sheet.getRow(startRow + 1)
  for (let col = 1; col <= totalCols; col++) bodyRow.getCell(col).fill = fill
  bodyRow.getCell(1).value = body
  bodyRow.getCell(1).font = { color: { argb: EXCEL_GREY_ARGB } }
  bodyRow.getCell(1).alignment = { wrapText: true }
  bodyRow.height = 30
  sheet.mergeCells(startRow + 1, 1, startRow + 1, totalCols)
}

/**
 * "2026-08" -> "Aug 2026". Sheet tab names need month *abbreviations* (Excel
 * caps tab names at 31 chars), so callers pass the request locale's short
 * month names.
 */
export const excelMonthLabelOf = (monthKey: string, monthNames: readonly string[]) => {
  const [year, month] = monthKey.split('-').map(Number)
  return `${monthNames[month - 1]} ${year}`
}

export interface MonthGroup<T> {
  key: string
  label: string
  items: T[]
}

/**
 * Groups records by calendar month (newest month first), so a long export —
 * a year of restocking, a year of one item's movements — splits into
 * readable per-month chunks rather than one giant sheet.
 */
export const groupByMonth = <T>(
  items: T[],
  dateOf: (item: T) => string,
  monthNames: readonly string[]
): MonthGroup<T>[] => {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = dateOf(item).slice(0, 7)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return [...groups.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map(key => ({ key, label: excelMonthLabelOf(key, monthNames), items: groups.get(key)! }))
}

// Safety valve for a single month with an unusually large number of rows —
// falls back to chunking within that month too.
export const EXCEL_MAX_ROWS_PER_SHEET = 500

// Splitting into per-month sheets is worth the extra tabs only once there's
// enough data to make one flat table unwieldy. A handful of records that
// happen to straddle a month boundary (e.g. 3 in July, 3 in August) reads
// far better as one inline list than as two near-empty sheets.
export const EXCEL_SPLIT_BY_MONTH_THRESHOLD = 30

/** Whether a record set spanning `monthCount` months is worth splitting by month. */
export const shouldSplitByMonth = (monthCount: number, totalRecords: number): boolean =>
  monthCount > 1 && totalRecords > EXCEL_SPLIT_BY_MONTH_THRESHOLD

/** Splits into <= EXCEL_MAX_ROWS_PER_SHEET chunks, e.g. "Aug 2026 (1-500)". */
export const chunkSheetName = (label: string, start: number, end: number) =>
  `${label} (${start}-${end})`
