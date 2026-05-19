import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type { CreateOrderInput } from '../validations/orderValidation'

export const orderService = {
  async createOrder(userId: number, shopId: number, payload: CreateOrderInput) {
    const {
      orderType,
      paymentMethod,
      paymentCurrency,
      receivedAmount,
      exchangeRateSnapshot,
      items,
    } = payload

    // ── 1. Validate all products belong to this shop ──────────────────
    const productIds = items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId, isAvailable: true },
    })

    if (products.length !== productIds.length) {
      throw new AppError(Messages.PRODUCT_NOT_FOUND, HttpStatus.BAD_REQUEST)
    }

    const productMap = new Map(products.map(p => [p.id, p]))

    // ── 2. Server-side price recalculation ────────────────────────────
    let serverTotal = 0
    for (const item of items) {
      const product = productMap.get(item.productId)!
      const basePrice = Number(product.price)
      const optionsExtra = item.selectedOptions.reduce((sum, o) => sum + o.extraPrice, 0)
      serverTotal += (basePrice + optionsExtra) * item.quantity
    }
    serverTotal = Math.round(serverTotal * 100) / 100

    // ── 3. Validate received amount is sufficient ─────────────────────
    const totalInPaymentCurrency =
      paymentCurrency === 'KHR' ? Math.ceil(serverTotal * exchangeRateSnapshot) : serverTotal

    if (receivedAmount < totalInPaymentCurrency) {
      throw new AppError(Messages.INSUFFICIENT_PAYMENT, HttpStatus.BAD_REQUEST)
    }

    // ── 4. Calculate change ───────────────────────────────────────────
    const changeAmount = Math.round((receivedAmount - totalInPaymentCurrency) * 100) / 100

    // ── 5. Generate order number ───────────────────────────────────────
    const orderNumber = `ORD-${Date.now().toString().slice(-7)}`

    // ── 6. Atomic transaction: Order + Items + Options + Inventory ────
    const order = await prisma.$transaction(async tx => {
      // Create the Order
      const createdOrder = await tx.order.create({
        data: {
          shopId,
          userId,
          orderNumber,
          orderType,
          totalAmount: serverTotal,
          discountAmount: 0,
          receivedAmount,
          paymentCurrency,
          exchangeRateSnapshot,
          paymentMethod,
          paymentStatus: 'paid',
          fulfillmentStatus: 'preparing',
        },
      })

      // Create OrderItems + OrderItemOptions
      for (const item of items) {
        const product = productMap.get(item.productId)!
        const basePrice = Number(product.price)
        const optionsExtra = item.selectedOptions.reduce((sum, o) => sum + o.extraPrice, 0)
        const subtotal = (basePrice + optionsExtra) * item.quantity

        const createdItem = await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: basePrice,
            extraPrice: optionsExtra,
            subtotal,
          },
        })

        // Create selected option records
        for (const option of item.selectedOptions) {
          await tx.orderItemOption.create({
            data: {
              orderItemId: createdItem.id,
              groupName: option.groupName,
              optionName: option.optionName,
              extraPrice: option.extraPrice,
            },
          })
        }
      }

      return createdOrder
    })

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: serverTotal,
      receivedAmount,
      paymentCurrency,
      changeAmount,
      exchangeRateSnapshot,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
    }
  },
}
