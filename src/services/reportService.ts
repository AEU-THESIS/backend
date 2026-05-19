import { prisma, AppError, HttpStatus } from '../core/Service'
import { getPeriodStartDate } from '../utils/date'

export const reportService = {
  async getSalesOverview(shopId: number, period: 'daily' | 'weekly' | 'monthly') {
    const startDate = getPeriodStartDate(period)

    const orders = await prisma.order.findMany({
      where: {
        shopId,
        createdAt: { gte: startDate },
        paymentStatus: 'paid',
      },
      select: {
        totalAmount: true,
        paymentCurrency: true,
      },
    })

    const totalOrders = orders.length
    let totalSales = 0
    let salesUSD = 0
    let salesKHR = 0

    orders.forEach(o => {
      const amt = Number(o.totalAmount)
      totalSales += amt
      if (o.paymentCurrency === 'USD') {
        salesUSD += amt
      } else {
        salesKHR += amt
      }
    })

    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      salesUSD,
      salesKHR,
    }
  },

  async getItemPerformance(shopId: number, period: 'daily' | 'weekly' | 'monthly') {
    const startDate = getPeriodStartDate(period)

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          shopId,
          createdAt: { gte: startDate },
          paymentStatus: 'paid',
        },
      },
      include: {
        product: {
          select: { name: true, price: true },
        },
      },
    })

    // Aggregate quantities and revenues by product in JavaScript to remain database-dialect independent
    const aggregation: Record<number, { name: string; quantity: number; revenue: number }> = {}

    orderItems.forEach(item => {
      const pid = item.productId
      const qty = item.quantity
      const subtotal = Number(item.subtotal)

      if (!aggregation[pid]) {
        aggregation[pid] = {
          name: item.product?.name || `Product #${pid}`,
          quantity: 0,
          revenue: 0,
        }
      }
      aggregation[pid].quantity += qty
      aggregation[pid].revenue += subtotal
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
        order: {
          shopId,
          createdAt: { gte: startDate },
          paymentStatus: 'paid',
        },
      },
      include: {
        product: {
          include: {
            category: { select: { name: true } },
          },
        },
      },
    })

    const aggregation: Record<string, { category: string; quantity: number; revenue: number }> = {}

    orderItems.forEach(item => {
      const catName = item.product?.category?.name || 'Uncategorized'
      const qty = item.quantity
      const subtotal = Number(item.subtotal)

      if (!aggregation[catName]) {
        aggregation[catName] = {
          category: catName,
          quantity: 0,
          revenue: 0,
        }
      }
      aggregation[catName].quantity += qty
      aggregation[catName].revenue += subtotal
    })

    return Object.values(aggregation)
  },

  async getInventoryInsights(shopId: number) {
    const ingredients = await prisma.ingredient.findMany({
      where: { shopId },
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
        'Total (USD)',
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
        where: { shopId },
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
