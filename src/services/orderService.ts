import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type { CreateOrderInput } from '../validations/orderValidation'
import { Prisma } from '@prisma/client'
import { promotionService } from './promotionService'
import { cartDiscounts, type CartLineForCalc } from '../utils/promotionDiscount'
import { shopDayStartUtc, shopDayEndUtc, shopDateString } from '../utils/date'
import { round2, roundRielUp, roundRielDown } from '../utils/money'

/**
 * Builds the next per-shop, per-day order number, e.g. `ORD-1-20260805-0001`.
 * The sequence resets each business day (the date is part of the number) and is
 * derived from the most recent order for today's prefix. Must run INSIDE the
 * checkout transaction so the read and the insert are atomic; simultaneous
 * checkouts that pick the same number are resolved by `withUniqueRetry`.
 * Because `shopId` is embedded, the global unique on `orderNumber` is enough —
 * no cross-shop or intra-shop collision is possible without hitting it.
 */
async function nextDailyOrderNumber(tx: Prisma.TransactionClient, shopId: number): Promise<string> {
  const datePart = shopDateString(0).replace(/-/g, '') // YYYYMMDD in the shop's timezone
  const prefix = `ORD-${shopId}-${datePart}-`

  const last = await tx.order.findFirst({
    where: { shopId, orderNumber: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { orderNumber: true },
  })

  const lastSeq = last ? Number(last.orderNumber.slice(prefix.length)) : 0
  const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1
  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}

/**
 * Runs `fn`, retrying on a Prisma unique-constraint violation (P2002). Lets two
 * simultaneous checkouts that generated the same order number recover
 * automatically instead of surfacing a validation error to the cashier.
 */
async function withUniqueRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < retries
      ) {
        continue
      }
      throw err
    }
  }
}

export const orderService = {
  async createOrder(userId: number, shopId: number, payload: CreateOrderInput) {
    const { orderType, paymentMethod, paymentCurrency, receivedAmount, items } = payload

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

    // Track which option sets are REQUIRED per product so an order can be rejected
    // when a mandatory choice (e.g. the size of a by-size drink) is missing.
    const requiredSetsByProduct = new Map<number, Set<number>>()

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

      if (pos.isRequired) {
        if (!requiredSetsByProduct.has(pos.productId)) {
          requiredSetsByProduct.set(pos.productId, new Set())
        }
        requiredSetsByProduct.get(pos.productId)!.add(pos.optionSetId)
      }
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
      // For a by-size product the base price is null on purpose (the real price
      // lives in the size option); treat null as 0 so it can't silently become a
      // valid-looking number, then enforce the guards below.
      const basePrice = product.price == null ? 0 : Number(product.price)

      let optionsExtra = 0
      const validatedOptions = []
      const chosenSetIds = new Set<number>()

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
        chosenSetIds.add(option.optionSetId)

        validatedOptions.push({
          groupName: optionSet.groupName,
          optionName: optionElement.optionName,
          extraPrice: dbExtraPrice,
        })
      }

      // Every required option set for this product must have been chosen.
      const requiredSetIds = requiredSetsByProduct.get(item.productId)
      if (requiredSetIds) {
        for (const requiredSetId of requiredSetIds) {
          if (!chosenSetIds.has(requiredSetId)) {
            throw new AppError(Messages.ORDER_ITEM_REQUIRES_OPTION, HttpStatus.BAD_REQUEST)
          }
        }
      }

      // A by-size product must have a size chosen, and no line may total 0 (which
      // would let a customer be charged nothing for a real item).
      if (product.priceMode === 'by_size' && chosenSetIds.size === 0) {
        throw new AppError(Messages.ORDER_ITEM_PRICE_INVALID, HttpStatus.BAD_REQUEST)
      }
      if (basePrice + optionsExtra <= 0) {
        throw new AppError(Messages.ORDER_ITEM_PRICE_INVALID, HttpStatus.BAD_REQUEST)
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

    // ── 2b. Server-side promotion application ─────────────────────────
    // Independently fetch the shop's active promotions and recompute the discount
    // here — never trust a client-supplied discount. At most one promotion applies
    // (the largest-discount match). serverTotal is the pre-discount subtotal.
    const cartLines: CartLineForCalc[] = validatedItemsList.map(v => ({
      productId: v.productId,
      categoryId: productMap.get(v.productId)!.categoryId,
      quantity: v.quantity,
      unitPrice: v.basePrice + v.optionsExtra,
      subtotal: v.subtotal,
    }))
    const activePromotions = await promotionService.getActiveByShop(shopId)
    const { total: discountAmount, applied } = cartDiscounts(activePromotions, cartLines)
    const appliedPromotionIds = applied.map(a => a.promotion.id)
    // The single largest-contributing promotion is recorded on the order (the schema
    // links one promotion per order); every applied promotion still has its
    // times_redeemed incremented below.
    const primaryPromotionId = applied.length
      ? applied.reduce((a, b) => (b.discount > a.discount ? b : a)).promotion.id
      : null
    // Never let stacked/fixed-amount discounts push the charge below zero.
    const netTotal = Math.max(0, Math.round((serverTotal - discountAmount) * 100) / 100)

    // ── 3. Resolve the authoritative exchange rate & payment amounts ──────
    // The exchange rate is read from the shop record (Shop Settings), never
    // trusted from the client, so the amount due always reflects the shop's own
    // configured rate and a customer can never underpay with a forged rate.
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { exchangeRate: true, isOrderManagementEnabled: true },
    })

    if (!shop) {
      throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const exchangeRate = Number(shop.exchangeRate)
    const fulfillmentStatus = shop.isOrderManagementEnabled !== false ? 'preparing' : 'completed'

    // Amount due in the payment currency. Riel is rounded UP to the nearest 100៛
    // (the smallest note) so the cashier can always collect it.
    const totalInPaymentCurrency =
      paymentCurrency === 'KHR' ? roundRielUp(netTotal * exchangeRate) : round2(netTotal)

    if (receivedAmount < totalInPaymentCurrency) {
      throw new AppError(Messages.INSUFFICIENT_PAYMENT, HttpStatus.BAD_REQUEST)
    }

    // ── 4. Calculate change & normalise the received amount to USD ────────
    // Change is rounded DOWN to the nearest 100៛ for riel so only payable notes
    // are returned. receivedAmountUsd lets reports sum every sale in one currency.
    const changeAmount =
      paymentCurrency === 'KHR'
        ? roundRielDown(receivedAmount - totalInPaymentCurrency)
        : round2(receivedAmount - totalInPaymentCurrency)

    const receivedAmountUsd =
      paymentCurrency === 'KHR' ? round2(receivedAmount / exchangeRate) : round2(receivedAmount)

    // ── 6. Atomic transaction: Order + Items + Options + Inventory ────
    // Retried on a duplicate order number (P2002) so a collision never reaches
    // the cashier as an error.
    const order = await withUniqueRetry(() =>
      prisma.$transaction(async tx => {
        // Generate the order number inside the tx so the read and the insert
        // are atomic (line-level uniqueness enforced by the DB + retry above).
        const orderNumber = await nextDailyOrderNumber(tx, shopId)

        // Re-verify the applied promotions still exist and are active inside the tx.
        // If one was deleted/deactivated between the read above and now, keep the
        // already-quoted discount (the customer was charged netTotal) but only record
        // and redeem the ones that survive, so a vanished promotion can't roll back an
        // otherwise-valid paid sale (fail-open).
        let activeAppliedIds: number[] = []
        if (appliedPromotionIds.length > 0) {
          const stillActive = await tx.promotion.findMany({
            where: { id: { in: appliedPromotionIds }, shopId, isActive: true },
            select: { id: true },
          })
          activeAppliedIds = stillActive.map(p => p.id)
        }
        const effectivePromotionId =
          primaryPromotionId && activeAppliedIds.includes(primaryPromotionId)
            ? primaryPromotionId
            : (activeAppliedIds[0] ?? null)

        // Create the Order
        const createdOrder = await tx.order.create({
          data: {
            shopId,
            userId,
            orderNumber,
            orderType,
            // totalAmount holds the net (discounted) total that was actually charged;
            // discountAmount records how much the promotion took off.
            totalAmount: netTotal,
            discountAmount,
            promotionId: effectivePromotionId,
            receivedAmount,
            receivedAmountUsd,
            changeAmount,
            paymentCurrency,
            // Persist the server-resolved rate so historical orders reconcile
            // exactly even if the shop later changes its exchange rate.
            exchangeRateSnapshot: exchangeRate,
            paymentMethod,
            paymentStatus: 'paid',
            fulfillmentStatus,
          },
        })

        // Record a redemption on every applied promotion (powers the dashboard metric)
        // and persist a per-promotion discount breakdown so order history can show it.
        if (activeAppliedIds.length > 0) {
          await tx.promotion.updateMany({
            where: { id: { in: activeAppliedIds } },
            data: { timesRedeemed: { increment: 1 } },
          })
          await tx.orderPromotion.createMany({
            data: applied
              .filter(a => activeAppliedIds.includes(a.promotion.id))
              .map(a => ({
                orderId: createdOrder.id,
                promotionId: a.promotion.id,
                discountAmount: a.discount,
              })),
          })
        }

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

          // Persist all selected options for this item in one round trip
          if (valItem.validatedOptions.length > 0) {
            await tx.orderItemOption.createMany({
              data: valItem.validatedOptions.map(option => ({
                orderItemId: createdItem.id,
                groupName: option.groupName,
                optionName: option.optionName,
                extraPrice: option.extraPrice,
              })),
            })
          }
        }

        return createdOrder
      })
    )

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      subtotal: serverTotal,
      discountAmount,
      // Reflect what was actually persisted (fail-open may have nulled it in-tx),
      // not the pre-transaction candidate.
      promotionId: order.promotionId,
      totalAmount: netTotal,
      receivedAmount,
      receivedAmountUsd,
      paymentCurrency,
      changeAmount,
      exchangeRateSnapshot: exchangeRate,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
    }
  },

  async getAllOrders(
    shopId: number,
    filters: {
      status?: string
      paymentStatus?: string
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

    // Date filters. createdAt is stored in UTC, so day windows are computed
    // against the café's local calendar day (see utils/date helpers) — never
    // the server's timezone. This keeps same-day orders (e.g. one placed just
    // after local midnight) inside the "today" window.
    if (date === 'today' || date === 'yesterday') {
      const day = date === 'today' ? shopDateString(0) : shopDateString(-1)
      whereClause.createdAt = {
        gte: shopDayStartUtc(day),
        lte: shopDayEndUtc(day),
      }
    } else if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = shopDayStartUtc(startDate)
      }
      if (endDate) {
        // Include the entire local endDate day.
        whereClause.createdAt.lte = shopDayEndUtc(endDate)
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
          promotion: {
            select: { id: true, name: true, discountType: true, discountValue: true },
          },
          appliedPromotions: {
            select: {
              promotionId: true,
              discountAmount: true,
              promotion: { select: { id: true, name: true, discountType: true } },
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
        promotion: {
          select: { id: true, name: true, discountType: true, discountValue: true },
        },
        appliedPromotions: {
          select: {
            promotionId: true,
            discountAmount: true,
            promotion: { select: { id: true, name: true, discountType: true } },
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
