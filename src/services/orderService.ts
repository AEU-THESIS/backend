import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type { CreateOrderInput } from '../validations/orderValidation'
import { Prisma } from '@prisma/client'

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

    // Fetch the shop settings to check if order management dashboard is enabled
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { isOrderManagementEnabled: true },
    })

    const fulfillmentStatus = shop?.isOrderManagementEnabled !== false ? 'preparing' : 'completed'

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
          fulfillmentStatus,
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

  async getAllOrders(
    shopId: number,
    filters: {
      status?: string
      paymentStatus?: string
      paymentMethod?: string
      date?: string
      search?: string
      startDate?: string
      endDate?: string
      page?: number
      limit?: number
    }
  ) {
    const {
      status,
      paymentStatus,
      paymentMethod,
      date,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters

    // Pre-query validation guards
    if (!Number.isInteger(page) || page <= 0) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const skip = (page - 1) * limit

    // Build query conditions
    const whereClause: any = {
      shopId,
    }

    // Status filter (preparing, ready, completed, canceled)
    if (status) {
      whereClause.fulfillmentStatus = status
    }

    // Payment status filter (paid, unpaid)
    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus
    }

    // Payment method filter (cash, khqr)
    if (paymentMethod) {
      whereClause.paymentMethod = paymentMethod
    }

    // Date filters
    if (date === 'today') {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)
      whereClause.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      }
    } else if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        // Make sure it goes until the end of the endDate day
        end.setHours(23, 59, 59, 999)
        whereClause.createdAt.lte = end
      }
    }

    // Search filter (fuzzy match on orderNumber or customerName)
    if (search) {
      whereClause.OR = [
        {
          orderNumber: {
            contains: search,
          },
        },
        {
          customerName: {
            contains: search,
          },
        },
      ]
    }

    // Fetch total matching records and items paginated
    const [total, orders] = await Promise.all([
      prisma.order.count({ where: whereClause }),
      prisma.order.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: true,
              options: true,
            },
          },
        },
      }),
    ])

    return {
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  },

  async getOrderById(shopId: number, orderId: number) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        shopId,
      },
      include: {
        items: {
          include: {
            product: true,
            options: true,
          },
        },
      },
    })

    if (!order) {
      throw new AppError(Messages.ORDER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    return order
  },

  async updateOrderStatus(shopId: number, orderId: number, status: string) {
    // 1. Validate status value
    const validStatuses = ['preparing', 'ready', 'completed', 'canceled']
    if (!validStatuses.includes(status)) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    // 2. Find order and verify shop ownership
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        shopId,
      },
    })

    if (!order) {
      throw new AppError(Messages.ORDER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    // 3. Update fulfillmentStatus
    try {
      const updatedOrder = await prisma.order.update({
        where: {
          id: orderId,
          shopId,
        },
        data: {
          fulfillmentStatus: status,
        },
        include: {
          items: {
            include: {
              product: true,
              options: true,
            },
          },
        },
      })

      return updatedOrder
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError(Messages.ORDER_NOT_FOUND, HttpStatus.NOT_FOUND)
      }
      throw error
    }
  },
}
