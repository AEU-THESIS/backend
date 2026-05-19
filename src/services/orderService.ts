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
    const uniqueProductIds = Array.from(new Set(productIds))
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, shopId, isAvailable: true },
    })

    if (products.length !== uniqueProductIds.length) {
      throw new AppError(Messages.PRODUCT_NOT_FOUND, HttpStatus.BAD_REQUEST)
    }

    const productMap = new Map(products.map(p => [p.id, p]))

    // Fetch secure option sets and elements assigned to these products
    const productOptionSets = await prisma.productOptionSet.findMany({
      where: { productId: { in: uniqueProductIds } },
      include: {
        optionSet: {
          include: {
            elements: true,
          },
        },
      },
    })

    // Build secure lookup cache: productId -> OptionSetId -> OptionSetInfo
    const productOptionsCache = new Map<
      number,
      Map<
        number,
        { groupName: string; elementsMap: Map<number, { optionName: string; extraPrice: number }> }
      >
    >()

    for (const pos of productOptionSets) {
      if (!productOptionsCache.has(pos.productId)) {
        productOptionsCache.set(pos.productId, new Map())
      }
      const optionSetsMap = productOptionsCache.get(pos.productId)!

      const elementsMap = new Map<number, { optionName: string; extraPrice: number }>()
      for (const elem of pos.optionSet.elements) {
        elementsMap.set(elem.id, {
          optionName: elem.label,
          extraPrice: Number(elem.priceModifier),
        })
      }

      optionSetsMap.set(pos.optionSetId, {
        groupName: pos.optionSet.name,
        elementsMap,
      })
    }

    // ── 2. Server-side price recalculation & Validation ────────────────
    let serverTotal = 0
    const validatedItemsList: Array<{
      productId: number
      quantity: number
      basePrice: number
      optionsExtra: number
      subtotal: number
      validatedOptions: Array<{
        groupName: string
        optionName: string
        extraPrice: number
      }>
    }> = []

    for (const item of items) {
      const product = productMap.get(item.productId)!
      const basePrice = Number(product.price)

      let optionsExtra = 0
      const validatedOptions = []

      const optionSetsMap = productOptionsCache.get(item.productId)

      for (const option of item.selectedOptions) {
        const optionSet = optionSetsMap?.get(option.optionSetId)
        if (!optionSet) {
          throw new AppError(Messages.ORDER_VALIDATION_FAILED, HttpStatus.BAD_REQUEST)
        }

        const optionElement = optionSet.elementsMap.get(option.elementId)
        if (!optionElement) {
          throw new AppError(Messages.ORDER_VALIDATION_FAILED, HttpStatus.BAD_REQUEST)
        }

        const dbExtraPrice = optionElement.extraPrice
        optionsExtra += dbExtraPrice

        validatedOptions.push({
          groupName: optionSet.groupName,
          optionName: optionElement.optionName,
          extraPrice: dbExtraPrice,
        })
      }

      const subtotal = (basePrice + optionsExtra) * item.quantity
      serverTotal += subtotal

      validatedItemsList.push({
        productId: item.productId,
        quantity: item.quantity,
        basePrice,
        optionsExtra,
        subtotal,
        validatedOptions,
      })
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

      // Create OrderItems + OrderItemOptions using fully validated server-canonical data
      for (const valItem of validatedItemsList) {
        const createdItem = await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: valItem.productId,
            quantity: valItem.quantity,
            price: valItem.basePrice,
            extraPrice: valItem.optionsExtra,
            subtotal: valItem.subtotal,
          },
        })

        // Create selected option records using canonical data
        for (const option of valItem.validatedOptions) {
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
