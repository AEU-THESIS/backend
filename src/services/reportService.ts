import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import { Prisma } from '@prisma/client'
import {
  getPeriodStartDate,
  getItemReportRange,
  ItemReportPeriod,
  getKpiRange,
  KpiRange,
  buildRangeBuckets,
  shopDayStartUtc,
  shopDayEndUtc,
  shopDateString,
  toShopWallClock,
} from '../utils/date'
import { buildSalesSummaryReport } from './salesSummaryExport'
import { renderSalesSummaryWorkbook, salesSummaryFileName } from '../utils/salesSummaryWorkbook'

// Cancelled/voided money must never show up in a report. Only orders that actually
// took money count: `paid`, plus `partially_refunded` (whose `totalAmount` already
// holds just the surviving net). `fulfillment_status = canceled` is also excluded so
// legacy paid-but-canceled orders drop out too. Reused across every report query.
const soldOrderWhere: Prisma.OrderWhereInput = {
  paymentStatus: { in: ['paid', 'partially_refunded'] },
  fulfillmentStatus: { not: 'canceled' },
}

/**
 * Item and category revenue must reconcile with Net Sales, which sums
 * `Order.totalAmount` — an after-discount figure. A line's own `subtotal` is a
 * gross, pre-discount amount, so summing subtotals overstates revenue by every
 * order's discount (AT-93). We close the gap by apportioning each order's net
 * total across its surviving lines in proportion to their gross subtotal:
 *
 *   lineNetRevenue = subtotal × (order.totalAmount ÷ order's surviving gross)
 *
 * Because `totalAmount` is itself `Σ subtotals − discount` (recomputed over the
 * surviving lines on cancellation), the per-order shares sum back to
 * `totalAmount` exactly — so period revenue sums to Net Sales regardless of how
 * the discount was distributed, and even when a large fixed discount clamped
 * the order's net to 0. `items` must be the same `canceledAt: null` lines the
 * reports aggregate, each carrying its parent order's id (`id`, `orderId`) and
 * `totalAmount`.
 *
 * Shares are computed in integer cents and the leftover cents from flooring are
 * handed to the largest-remainder lines (stable tiebreak by order-item id), so
 * each order's lines sum back to its net to the cent — no fractional-cent drift
 * against Net Sales (AT-93).
 */
function apportionNetRevenue<
  T extends {
    id: number
    orderId: number
    subtotal: Prisma.Decimal
    order: { totalAmount: Prisma.Decimal }
  },
>(items: T[]): Map<T, number> {
  // Group surviving (report-visible) lines by their parent order.
  const linesByOrder = new Map<number, T[]>()
  for (const item of items) {
    const group = linesByOrder.get(item.orderId)
    if (group) group.push(item)
    else linesByOrder.set(item.orderId, [item])
  }

  const netByLine = new Map<T, number>()
  for (const lines of linesByOrder.values()) {
    const gross = lines.reduce((sum, l) => sum + Number(l.subtotal), 0)
    const netCents = Math.round(Number(lines[0].order.totalAmount) * 100)

    // gross === 0 only when every surviving line is complimentary (subtotal 0),
    // in which case the order's net is 0 too — nothing to apportion, avoid ÷0.
    if (gross <= 0) {
      for (const line of lines) netByLine.set(line, 0)
      continue
    }

    // Floor each line's cent share, then distribute the leftover cents to the
    // lines with the largest fractional remainder so the shares sum to netCents.
    const shares = lines.map(line => {
      const exact = (Number(line.subtotal) * netCents) / gross
      const floor = Math.floor(exact)
      return { line, floor, remainder: exact - floor }
    })
    let residual = netCents - shares.reduce((sum, s) => sum + s.floor, 0)
    shares.sort((a, b) => b.remainder - a.remainder || a.line.id - b.line.id)
    for (const s of shares) {
      const cents = s.floor + (residual > 0 ? 1 : 0)
      if (residual > 0) residual--
      netByLine.set(s.line, cents / 100)
    }
  }
  return netByLine
}

export const reportService = {
  /**
   * Cash/KHQR breakdown for one day, or for the inclusive window
   * [date, endDate] when `endDate` is supplied. Omitting `endDate` keeps the
   * original single-day behaviour.
   */
  async getDailySummary(shopId: number, date?: string, endDate?: string) {
    const firstDay = date ?? shopDateString(0)
    const lastDay = endDate ?? firstDay

    if (lastDay < firstDay) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const startOfDay = shopDayStartUtc(firstDay)
    const endOfDay = shopDayEndUtc(lastDay)

    const [groups, shop] = await Promise.all([
      prisma.order.groupBy({
        by: ['paymentMethod'],
        where: {
          shopId,
          ...soldOrderWhere,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { totalAmount: true },
      }),
      prisma.shop.findUnique({
        where: { id: shopId },
        select: { exchangeRate: true },
      }),
    ])

    let totalRevenue = 0
    let cashTotal = 0
    let khqrTotal = 0

    groups.forEach(g => {
      const sum = Number(g._sum.totalAmount ?? 0)
      totalRevenue += sum

      const method = g.paymentMethod?.toLowerCase().trim()
      if (method === 'cash') cashTotal += sum
      else if (method === 'khqr') khqrTotal += sum
    })

    return {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      cash_total: Math.round(cashTotal * 100) / 100,
      khqr_total: Math.round(khqrTotal * 100) / 100,
      exchange_rate: Number(shop?.exchangeRate ?? 4100),
    }
  },
  /**
   * Headline KPIs for the analytics dashboard: net sales (USD), total paid
   * orders, and active staff — with period-over-period trends for the first two.
   */
  async getKpiSummary(shopId: number, range: KpiRange, startDate?: string, endDate?: string) {
    const { start, end, prevStart, prevEnd } = getKpiRange(range, startDate, endDate)

    const salesFor = async (from: Date, to: Date) => {
      const orders = await prisma.order.findMany({
        where: { shopId, ...soldOrderWhere, createdAt: { gte: from, lte: to } },
        select: { totalAmount: true },
      })
      const netSales = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
      return { netSales: Math.round(netSales * 100) / 100, totalOrders: orders.length }
    }

    const [current, previous, activeStaff] = await Promise.all([
      salesFor(start, end),
      salesFor(prevStart, prevEnd),
      prisma.user.count({ where: { shopId, isActive: true, isDeleted: false } }),
    ])

    // Percentage change vs previous window; null when there is no baseline.
    const trend = (curr: number, prev: number): number | null =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 1000) / 10

    return {
      netSales: current.netSales,
      totalOrders: current.totalOrders,
      activeStaff,
      netSalesTrend: trend(current.netSales, previous.netSales),
      totalOrdersTrend: trend(current.totalOrders, previous.totalOrders),
    }
  },

  /**
   * Returns either the top 5 best-selling or the bottom 5 lowest-selling
   * products (by units sold) for the requested period, including their category.
   * Only the requested `type` is computed and returned.
   */
  async getSellingItems(
    shopId: number,
    type: 'top' | 'bottom',
    period: ItemReportPeriod,
    month?: string,
    startDate?: string,
    endDate?: string
  ) {
    // An explicit [startDate, endDate] window (from the global filter) takes
    // precedence over the preset period.
    const { start, end } =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : getItemReportRange(period, month)

    const orderItems = await prisma.orderItem.findMany({
      where: {
        canceledAt: null,
        order: {
          shopId,
          ...soldOrderWhere,
          createdAt: { gte: start, lte: end },
        },
      },
      include: {
        order: { select: { totalAmount: true } },
        product: {
          select: {
            name: true,
            category: { select: { name: true } },
          },
        },
      },
    })

    // Revenue is the after-discount share of each line (see apportionNetRevenue),
    // so item revenue reconciles with Net Sales rather than the gross subtotal.
    const netRevenue = apportionNetRevenue(orderItems)

    // Aggregate quantity/revenue per product in JS to stay database-dialect independent.
    const aggregation: Record<
      number,
      { productId: number; name: string; category: string; quantity: number; revenue: number }
    > = {}

    orderItems.forEach(item => {
      const pid = item.productId
      if (!aggregation[pid]) {
        aggregation[pid] = {
          productId: pid,
          name: item.product?.name || `Product #${pid}`,
          category: item.product?.category?.name || 'Uncategorized',
          quantity: 0,
          revenue: 0,
        }
      }
      aggregation[pid].quantity += item.quantity
      aggregation[pid].revenue += netRevenue.get(item) ?? 0
    })

    const productList = Object.values(aggregation).map(p => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
    }))

    const items = productList
      .sort((a, b) => (type === 'top' ? b.quantity - a.quantity : a.quantity - b.quantity))
      .slice(0, 5)

    return { items }
  },

  async getSalesOverview(shopId: number, period: 'daily' | 'weekly' | 'monthly') {
    const startDate = getPeriodStartDate(period)

    const orders = await prisma.order.findMany({
      where: {
        shopId,
        ...soldOrderWhere,
        createdAt: { gte: startDate },
      },
      select: {
        totalAmount: true,
        paymentCurrency: true,
        exchangeRateSnapshot: true,
      },
    })

    const totalOrders = orders.length
    let totalSales = 0 // Unified base in USD
    let salesUSD = 0
    let salesKHR = 0
    let countUSD = 0
    let countKHR = 0

    orders.forEach(o => {
      const amtUSD = Number(o.totalAmount)
      totalSales += amtUSD

      if (o.paymentCurrency === 'USD') {
        salesUSD += amtUSD
        countUSD++
      } else {
        const amtKHR = amtUSD * Number(o.exchangeRateSnapshot)
        salesKHR += amtKHR
        countKHR++
      }
    })

    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
    const averageOrderValueUSD = countUSD > 0 ? salesUSD / countUSD : 0
    const averageOrderValueKHR = countKHR > 0 ? salesKHR / countKHR : 0

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      salesUSD: Math.round(salesUSD * 100) / 100,
      salesKHR: Math.round(salesKHR * 100) / 100,
      averageOrderValueUSD: Math.round(averageOrderValueUSD * 100) / 100,
      averageOrderValueKHR: Math.round(averageOrderValueKHR * 100) / 100,
    }
  },

  /**
   * Net-sales time series for the "Net Sales Overview" chart. Buckets paid
   * orders (USD base, matching KPI net sales) into ordered `{ label, value }`
   * points:
   *  - weekly : the current week, Monday → Sunday (7 buckets)
   *  - monthly: the current year, January → the current month
   *  - yearly : the last 5 calendar years, oldest → current
   */
  async getSalesTrend(
    shopId: number,
    granularity: 'weekly' | 'monthly' | 'yearly',
    startDate?: string,
    endDate?: string
  ) {
    // Global-filter path: bucket an arbitrary [startDate, endDate] window
    // adaptively (hourly → daily → weekly → monthly → yearly) instead of using
    // the fixed weekly/monthly/yearly presets.
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const { points, bucketIndex } = buildRangeBuckets(start, end)

      const orders = await prisma.order.findMany({
        where: { shopId, ...soldOrderWhere, createdAt: { gte: start, lte: end } },
        select: { totalAmount: true, createdAt: true },
      })

      orders.forEach(o => {
        const idx = bucketIndex(o.createdAt)
        if (idx >= 0 && idx < points.length) {
          points[idx].value += Number(o.totalAmount)
        }
      })

      points.forEach(p => {
        p.value = Math.round(p.value * 100) / 100
      })

      return { granularity, points }
    }

    // Preset windows are anchored to the shop's local calendar, and stored
    // timestamps are bucketed by their shop-local wall clock — so an order taken
    // late in the shop's evening lands in the right day/month/year, not the
    // server's.
    const now = new Date()
    const shopNow = toShopWallClock(now)
    let start: Date
    let points: { label: string; value: number }[]
    let bucketIndex: (d: Date) => number

    if (granularity === 'weekly') {
      const mondayOffset = (shopNow.getUTCDay() + 6) % 7 // Sunday(0) → 6, Monday(1) → 0
      start = shopDayStartUtc(shopDateString(-mondayOffset))
      points = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => ({ label, value: 0 }))
      bucketIndex = d => (toShopWallClock(d).getUTCDay() + 6) % 7
    } else if (granularity === 'monthly') {
      start = shopDayStartUtc(`${shopNow.getUTCFullYear()}-01-01`)
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]
      points = months.map(label => ({ label, value: 0 }))
      bucketIndex = d => toShopWallClock(d).getUTCMonth()
    } else {
      const startYear = shopNow.getUTCFullYear() - 4
      start = shopDayStartUtc(`${startYear}-01-01`)
      points = Array.from({ length: shopNow.getUTCFullYear() - startYear + 1 }, (_, i) => ({
        label: String(startYear + i),
        value: 0,
      }))
      bucketIndex = d => toShopWallClock(d).getUTCFullYear() - startYear
    }

    const orders = await prisma.order.findMany({
      where: {
        shopId,
        ...soldOrderWhere,
        createdAt: { gte: start, lte: now },
      },
      select: { totalAmount: true, createdAt: true },
    })

    // Accumulate net sales into buckets in JS to stay database-dialect independent.
    for (const o of orders) {
      const idx = bucketIndex(o.createdAt)
      if (idx >= 0 && idx < points.length) {
        points[idx].value += Number(o.totalAmount)
      }
    }

    for (const p of points) {
      p.value = Math.round(p.value * 100) / 100
    }

    return { granularity, points }
  },

  async getItemPerformance(shopId: number, period: 'daily' | 'weekly' | 'monthly') {
    const startDate = getPeriodStartDate(period)

    const orderItems = await prisma.orderItem.findMany({
      where: {
        canceledAt: null,
        order: {
          shopId,
          ...soldOrderWhere,
          createdAt: { gte: startDate },
        },
      },
      include: {
        order: { select: { totalAmount: true } },
        product: {
          select: { name: true, price: true },
        },
      },
    })

    // After-discount revenue share per line, so item revenue reconciles with Net Sales.
    const netRevenue = apportionNetRevenue(orderItems)

    // Aggregate quantities and revenues by product in JavaScript to remain database-dialect independent
    const aggregation: Record<number, { name: string; quantity: number; revenue: number }> = {}

    orderItems.forEach(item => {
      const pid = item.productId
      const qty = item.quantity

      if (!aggregation[pid]) {
        aggregation[pid] = {
          name: item.product?.name || `Product #${pid}`,
          quantity: 0,
          revenue: 0,
        }
      }
      aggregation[pid].quantity += qty
      aggregation[pid].revenue += netRevenue.get(item) ?? 0
    })

    const productList = Object.values(aggregation)

    // Sort descending for best sellers
    const topSellers = [...productList].sort((a, b) => b.quantity - a.quantity).slice(0, 5)

    // Sort ascending for lowest sellers
    const bottomSellers = [...productList].sort((a, b) => a.quantity - b.quantity).slice(0, 5)

    return {
      topSellers,
      bottomSellers,
    }
  },

  async getCategoryPerformance(shopId: number, period: 'daily' | 'weekly' | 'monthly') {
    const startDate = getPeriodStartDate(period)

    const orderItems = await prisma.orderItem.findMany({
      where: {
        canceledAt: null,
        order: {
          shopId,
          ...soldOrderWhere,
          createdAt: { gte: startDate },
        },
      },
      include: {
        order: { select: { totalAmount: true } },
        product: {
          include: {
            category: { select: { name: true } },
          },
        },
      },
    })

    // After-discount revenue share per line, so category revenue reconciles with Net Sales.
    const netRevenue = apportionNetRevenue(orderItems)

    const aggregation: Record<string, { category: string; quantity: number; revenue: number }> = {}

    orderItems.forEach(item => {
      const catName = item.product?.category?.name || 'Uncategorized'
      const qty = item.quantity

      if (!aggregation[catName]) {
        aggregation[catName] = {
          category: catName,
          quantity: 0,
          revenue: 0,
        }
      }
      aggregation[catName].quantity += qty
      aggregation[catName].revenue += netRevenue.get(item) ?? 0
    })

    return Object.values(aggregation)
  },

  async getInventoryInsights(shopId: number) {
    const ingredients = await prisma.ingredient.findMany({
      // Ingredients are soft-deleted; insights cover the live catalogue only.
      where: { shopId, deletedAt: null },
      select: {
        id: true,
        name: true,
        currentStock: true,
        lowStockThreshold: true,
        unitOfMeasure: true,
      },
    })

    const outOfStock: any[] = []
    const lowStock: any[] = []

    ingredients.forEach(ing => {
      const stock = Number(ing.currentStock)
      const threshold = Number(ing.lowStockThreshold)

      if (stock <= 0) {
        outOfStock.push({
          id: ing.id,
          name: ing.name,
          currentStock: stock,
          unitOfMeasure: ing.unitOfMeasure,
        })
      } else if (stock <= threshold) {
        lowStock.push({
          id: ing.id,
          name: ing.name,
          currentStock: stock,
          lowStockThreshold: threshold,
          unitOfMeasure: ing.unitOfMeasure,
        })
      }
    })

    return {
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      outOfStock,
      lowStock,
    }
  },

  /**
   * Builds the "Menu Performance" Sales Summary workbook for an inclusive window
   * of shop-local days. Returns `null` when the window sold nothing, so the
   * controller can answer 204 instead of handing back an empty sheet.
   */
  async getSalesSummaryExport(shopId: number, startDate: string, endDate: string) {
    const [orders, shop] = await Promise.all([
      prisma.order.findMany({
        where: {
          shopId,
          ...soldOrderWhere,
          createdAt: { gte: shopDayStartUtc(startDate), lte: shopDayEndUtc(endDate) },
        },
        select: {
          createdAt: true,
          paymentMethod: true,
          bankName: true,
          discountAmount: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              price: true,
              extraPrice: true,
              subtotal: true,
              canceledQuantity: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } }),
    ])

    if (!shop) {
      throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const report = buildSalesSummaryReport(orders, { startDate, endDate })
    if (report.days.length === 0) return null

    const buffer = await renderSalesSummaryWorkbook(report, {
      shopName: shop.name,
      generatedAt: new Date(),
    })

    return { buffer, fileName: salesSummaryFileName(startDate, endDate) }
  },

  async getCSVExportData(
    shopId: number,
    type: 'sales' | 'inventory',
    period: 'daily' | 'weekly' | 'monthly'
  ) {
    if (type === 'sales') {
      const startDate = getPeriodStartDate(period)
      const orders = await prisma.order.findMany({
        where: {
          shopId,
          ...soldOrderWhere,
          createdAt: { gte: startDate },
        },
        include: {
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      // Convert orders list to CSV string
      const headers = [
        'Order Number',
        'Date',
        'Cashier',
        'Type',
        'Total Amount',
        'Currency',
        'Amount Received',
        'Payment Status',
      ]
      const rows = orders.map(o => [
        o.orderNumber,
        o.createdAt.toISOString(),
        o.user?.name || 'System',
        o.orderType,
        Number(o.totalAmount).toFixed(2),
        o.paymentCurrency,
        Number(o.receivedAmount).toFixed(2),
        o.paymentStatus,
      ])

      return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')
    } else {
      const ingredients = await prisma.ingredient.findMany({
        where: { shopId, deletedAt: null },
        orderBy: { name: 'asc' },
      })

      const headers = [
        'Ingredient ID',
        'Name',
        'Current Stock',
        'Low Stock Threshold',
        'Unit of Measure',
        'Status',
      ]
      const rows = ingredients.map(ing => {
        const stock = Number(ing.currentStock)
        const threshold = Number(ing.lowStockThreshold)
        let status = 'Good'
        if (stock <= 0) status = 'Out of Stock'
        else if (stock <= threshold) status = 'Low Stock'

        return [ing.id, ing.name, stock.toFixed(2), threshold.toFixed(2), ing.unitOfMeasure, status]
      })

      return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')
    }
  },
}
