// Assembles the data behind the two inventory Excel downloads and hands it to
// the workbook renderers. Split out of `inventoryService` because it is a
// separate concern (presentation of a report, not inventory rules) and pulls in
// locale, shop-currency and charting dependencies the rest of inventory has no
// use for.

import { prisma } from '../core/Service'
import { inventoryService } from './inventoryService'
import { KHR_SYMBOL, DEFAULT_EXCHANGE_RATE, normalizeCurrencySymbol } from '../constants/currency'
import {
  INTL_LOCALE_OF,
  inventoryExportLabels,
  type ExportLocale,
} from '../constants/inventoryExportLabels'
import {
  expenseReportFileName,
  renderExpenseReportWorkbook,
  renderStockHistoryWorkbook,
  stockHistoryFileName,
  type ExportFormatters,
  type StockHistoryRow,
} from '../utils/inventoryReportWorkbook'
import { toShopDateString, toShopWallClock } from '../utils/date'
import type {
  InventoryExpenseReportExportQueryInput,
  InventoryHistoryExportQueryInput,
} from '../validations/inventoryValidation'

/** What a controller needs to stream the file back. */
export interface ExportedWorkbook {
  buffer: Buffer
  fileName: string
}

/**
 * Mirrors the client's `useShopSettingsStore.formatAmount`, so a figure written
 * into a workbook reads exactly as it does on screen: dollars to two decimals,
 * riel converted at the shop's rate and grouped in thousands.
 */
const buildFormatters = (
  locale: ExportLocale,
  currency: string,
  exchangeRate: number
): ExportFormatters => {
  const intlLocale = INTL_LOCALE_OF[locale]

  return {
    money: amount =>
      currency === KHR_SYMBOL
        ? `${currency}${Math.round(amount * exchangeRate).toLocaleString('en-US')}`
        : `${currency}${amount.toFixed(2)}`,
    number: value => value.toLocaleString(intlLocale),
    // Timestamps are stored in UTC but must read in the café's local time, the
    // same wall clock the on-screen table shows.
    dateTime: date =>
      new Intl.DateTimeFormat(intlLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(toShopWallClock(date)),
  }
}

const getShopCurrency = async (shopId: number) => {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { currencySymbol: true, exchangeRate: true },
  })

  const exchangeRate = Number(shop?.exchangeRate)

  return {
    currency: normalizeCurrencySymbol(shop?.currencySymbol),
    exchangeRate: Number.isFinite(exchangeRate) ? exchangeRate : DEFAULT_EXCHANGE_RATE,
  }
}

export const inventoryExportService = {
  /**
   * The Expense Report workbook for a date range: KPI cards, the daily-spend
   * chart, and every individual purchase in the period.
   */
  async getExpenseReportWorkbook(
    shopId: number,
    query: InventoryExpenseReportExportQueryInput
  ): Promise<ExportedWorkbook> {
    const { startDate, endDate, locale } = query

    // Two groupings of the same range: `raw` for the per-purchase table and
    // `day` for the chart, exactly as the on-screen report reads them, so the
    // file can never disagree with the page it was exported from.
    const [raw, byDay] = await Promise.all([
      inventoryService.getExpenseReport(shopId, { startDate, endDate, groupBy: 'raw' }),
      inventoryService.getExpenseReport(shopId, { startDate, endDate, groupBy: 'day' }),
    ])

    const startLabel = startDate.slice(0, 10)
    const endLabel = endDate.slice(0, 10)

    const buffer = await renderExpenseReportWorkbook({
      records: raw.groupBy === 'raw' ? raw.data : [],
      chartPoints:
        byDay.groupBy === 'day'
          ? byDay.data.map(point => ({ label: point.label, value: point.totalSpend }))
          : [],
      totalSpend: raw.totalSpend,
      purchaseCount: raw.purchaseCount,
      startLabel,
      endLabel,
      currency: raw.currency,
      labels: inventoryExportLabels(locale),
    })

    return { buffer, fileName: expenseReportFileName(startLabel, endLabel) }
  },

  /**
   * One item's Stock History workbook for a date range: KPI cards, the daily
   * net-value chart, and every movement in the period (not just the page the
   * table happens to be showing).
   */
  async getHistoryWorkbook(
    id: number,
    shopId: number,
    query: InventoryHistoryExportQueryInput
  ): Promise<ExportedWorkbook> {
    const { from, to, type, locale } = query

    const [item, history, shopCurrency] = await Promise.all([
      inventoryService.getById(id, shopId),
      inventoryService.getHistoryForExport(id, shopId, { from, to, type }),
      getShopCurrency(shopId),
    ])

    const entries: StockHistoryRow[] = history.items.map(entry => ({
      type: entry.type === 'add' ? 'add' : 'remove',
      quantityChanged: entry.quantityChanged,
      unitCost: entry.unitCost,
      value: entry.value,
      notes: entry.notes,
      user: entry.user,
      createdAt: entry.createdAt,
      // Bucketed on the café's calendar day, so a movement lands in the month a
      // user would expect from the Date column rather than shifting on UTC.
      localDate: toShopDateString(entry.createdAt),
    }))

    // The range is optional on this endpoint; fall back to the span the data
    // actually covers so the banner and file name always name a period.
    const dates = entries.map(entry => entry.localDate).sort()
    const startLabel = from ? from.slice(0, 10) : (dates[0] ?? toShopDateString(new Date()))
    const endLabel = to ? to.slice(0, 10) : (dates[dates.length - 1] ?? startLabel)

    const buffer = await renderStockHistoryWorkbook({
      item: {
        name: item.name,
        unitOfMeasure: item.unitOfMeasure,
        quantity: item.quantity,
        totalValue: item.totalValue,
        categoryName: item.category?.name ?? null,
      },
      entries,
      totals: history.totals,
      typeFilter: type ?? 'all',
      startLabel,
      endLabel,
      currency: shopCurrency.currency,
      labels: inventoryExportLabels(locale),
      format: buildFormatters(locale, shopCurrency.currency, shopCurrency.exchangeRate),
    })

    return { buffer, fileName: stockHistoryFileName(item.name, startLabel, endLabel) }
  },
}
