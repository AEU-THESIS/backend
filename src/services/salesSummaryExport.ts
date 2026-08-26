/**
 * Aggregation behind the Sales Summary Excel export: turns the sold orders of a
 * date window into the "Menu Performance" shape — one row-block per shop-local
 * day, each day's items split by payment method.
 *
 * Kept beside `reportService` (which owns the query and the file handoff) so the
 * arithmetic can be read on its own.
 */

import { round2 } from '../utils/money'
import { toShopDateString } from '../utils/date'
import type {
  SalesSummaryDay,
  SalesSummaryItemBlock,
  SalesSummaryPaymentRow,
  SalesSummaryReport,
} from '../utils/salesSummaryWorkbook'

/** Column D wording, matching the report template ('khqr' prints as 'QR'). */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  khqr: 'QR',
  cod: 'COD',
}

/** Row order inside an item block; anything unmapped follows, alphabetically. */
const PAYMENT_METHOD_ORDER = ['Cash', 'QR', 'COD']

const paymentMethodLabel = (method?: string | null) => {
  const key = (method ?? '').trim().toLowerCase()
  if (!key) return 'Unknown'
  return PAYMENT_METHOD_LABELS[key] ?? key.toUpperCase()
}

/** The order fields this aggregation needs — a subset of the Prisma row. */
export interface ExportableOrderItem {
  productId: number
  quantity: number
  price: unknown
  extraPrice: unknown
  subtotal: unknown
  canceledQuantity: number
  product: { name: string } | null
}

export interface ExportableOrder {
  createdAt: Date
  paymentMethod: string
  discountAmount: unknown
  items: ExportableOrderItem[]
}

/** One order line reduced to what the report needs. */
interface ReportableLine {
  itemName: string
  unitPrice: number
  quantity: number
  gross: number
  /** What the line actually contributed to the order total (0 for a comp). */
  charged: number
}

const toReportableLine = (item: ExportableOrderItem): ReportableLine | null => {
  // A cancelled line stays on the order, so only the surviving quantity sold.
  const quantity = Number(item.quantity) - Number(item.canceledQuantity ?? 0)
  if (!Number.isFinite(quantity) || quantity <= 0) return null

  const unitPrice = round2(Number(item.price) + Number(item.extraPrice ?? 0))
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null

  const gross = round2(unitPrice * quantity)
  // `subtotal` is 0 on a complimentary (loyalty-stamp) line, so its whole gross
  // lands in the Discounts column — which is exactly what the report should say.
  const charged = Math.min(Math.max(Number(item.subtotal) || 0, 0), gross)

  return {
    itemName: item.product?.name?.trim() || `#${item.productId}`,
    unitPrice,
    quantity,
    gross,
    charged,
  }
}

/** Groups per (item, unit price) so `Gross = Qty x Price` holds cent-exactly. */
const itemKey = (line: Pick<ReportableLine, 'itemName' | 'unitPrice'>) =>
  `${line.itemName} ${line.unitPrice.toFixed(2)}`

interface ItemAccumulator {
  key: string
  itemName: string
  unitPrice: number
  rows: Map<string, { quantity: number; discounts: number }>
}

/**
 * Spreads an order's promotion discount across its lines in proportion to what
 * each contributed, because promotions are recorded per order, not per item.
 *
 * Rules, in the order they apply:
 *
 * - Every line but the last gets `round2(orderDiscount * charged / chargedTotal)`.
 * - The last line gets whatever is left (`orderDiscount - allocated`) rather than
 *   its own proportional share, which is what normally makes the shares sum back
 *   to `orderDiscount`. A single-line order therefore takes this path outright.
 * - When `chargedTotal` is 0 — every line comped, yet the order still carries a
 *   discount — the proportional branch has nothing to divide by, so each earlier
 *   line gets 0 and the whole discount falls on the last line.
 * - A share is floored at 0 before being returned, while `allocated` keeps
 *   tracking the unclamped value.
 *
 * Those last two rules mean the shares do not always reconcile with the order's
 * `discountAmount`:
 *
 * - Rounding can overshoot. Splitting 0.11 across three equal lines allocates
 *   0.04 three times (0.12), so the last line's residual is -0.01, is floored to
 *   0, and the day reports a cent more discount than the order recorded.
 * - The caller caps each line's discount at that line's gross (see
 *   `buildSalesSummaryReport`), so a residual larger than the last line's gross —
 *   the `chargedTotal === 0` case above — is silently dropped instead.
 *
 * Both are sub-cent on real orders; the shapes that expose them (a discount on a
 * fully comped order, a discount smaller than the line count in cents) are not
 * ones the POS produces.
 */
const allocateOrderDiscount = (lines: ReportableLine[], orderDiscount: number) => {
  const chargedTotal = lines.reduce((sum, line) => sum + line.charged, 0)
  const shares: number[] = []
  let allocated = 0

  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1
    const share = isLast
      ? round2(orderDiscount - allocated)
      : chargedTotal > 0
        ? round2((orderDiscount * line.charged) / chargedTotal)
        : 0
    allocated = round2(allocated + share)
    shares.push(Math.max(0, share))
  })

  return shares
}

export const buildSalesSummaryReport = (
  orders: ExportableOrder[],
  range: { startDate: string; endDate: string }
): SalesSummaryReport => {
  const dayBuckets = new Map<string, Map<string, ItemAccumulator>>()
  // Item order is ranked once over the whole window and reused for every day, so
  // a reader can follow the same item down the same position in each day block.
  const netByItem = new Map<string, number>()

  for (const order of orders) {
    const day = toShopDateString(order.createdAt)
    if (day < range.startDate || day > range.endDate) continue

    const lines = (order.items ?? [])
      .map(toReportableLine)
      .filter((line): line is ReportableLine => line !== null)
    if (lines.length === 0) continue

    const method = paymentMethodLabel(order.paymentMethod)
    const shares = allocateOrderDiscount(lines, Math.max(0, Number(order.discountAmount) || 0))

    let items = dayBuckets.get(day)
    if (!items) {
      items = new Map<string, ItemAccumulator>()
      dayBuckets.set(day, items)
    }

    lines.forEach((line, index) => {
      const key = itemKey(line)
      let item = items.get(key)
      if (!item) {
        item = { key, itemName: line.itemName, unitPrice: line.unitPrice, rows: new Map() }
        items.set(key, item)
      }

      // A line can never discount more than it grossed, so an oversized share
      // (see `allocateOrderDiscount`) is cut here rather than inflating the column.
      const discounts = Math.min(round2(line.gross - line.charged + shares[index]), line.gross)
      const row = item.rows.get(method) ?? { quantity: 0, discounts: 0 }
      row.quantity += line.quantity
      row.discounts = round2(row.discounts + discounts)
      item.rows.set(method, row)

      netByItem.set(key, round2((netByItem.get(key) ?? 0) + (line.gross - discounts)))
    })
  }

  const methodRank = (method: string) => {
    const index = PAYMENT_METHOD_ORDER.indexOf(method)
    return index === -1 ? PAYMENT_METHOD_ORDER.length : index
  }

  const totals = { quantity: 0, gross: 0, discounts: 0, net: 0 }

  const days: SalesSummaryDay[] = [...dayBuckets.keys()].sort().map(date => {
    const items: SalesSummaryItemBlock[] = [...dayBuckets.get(date)!.values()]
      .sort(
        (a, b) =>
          (netByItem.get(b.key) ?? 0) - (netByItem.get(a.key) ?? 0) ||
          a.itemName.localeCompare(b.itemName) ||
          a.unitPrice - b.unitPrice
      )
      .map(item => {
        const rows: SalesSummaryPaymentRow[] = [...item.rows.entries()]
          .sort(([a], [b]) => methodRank(a) - methodRank(b) || a.localeCompare(b))
          .map(([paymentMethod, row]) => {
            const gross = round2(item.unitPrice * row.quantity)
            const discounts = Math.min(row.discounts, gross)
            const net = round2(gross - discounts)

            totals.quantity += row.quantity
            totals.gross = round2(totals.gross + gross)
            totals.discounts = round2(totals.discounts + discounts)
            totals.net = round2(totals.net + net)

            return { paymentMethod, quantity: row.quantity, gross, discounts, net }
          })

        return { itemName: item.itemName, unitPrice: item.unitPrice, rows }
      })

    return { date, items }
  })

  return { startDate: range.startDate, endDate: range.endDate, days, totals }
}
