import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type { CreateOrderInput } from '../validations/orderValidation'
import { Prisma } from '@prisma/client'
import { promotionService } from './promotionService'
import {
  cartDiscounts,
  recalcSurvivorMoney,
  type CartLineForCalc,
  type PromotionForCalc,
} from '../utils/promotionDiscount'
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

type ProductOptionSetWithElements = Prisma.ProductOptionSetGetPayload<{
  include: { optionSet: { include: { elements: true } } }
}>

interface OptionSetInfo {
  groupName: string
  elementsMap: Map<number, { optionName: string; extraPrice: number }>
}

interface ProductOptionIndex {
  // productId -> optionSetId -> option-set info (labels + per-element extra price)
  cache: Map<number, Map<number, OptionSetInfo>>
  // productId -> ids of option sets that MUST be chosen
  requiredSets: Map<number, Set<number>>
  // productId -> ids of the size-type option sets (a by-size product prices off one)
  sizeSets: Map<number, Set<number>>
}

/**
 * Builds a secure lookup index of a product's option sets for order validation.
 * Prices and labels come from here (never the client), and it records which sets
 * are required and which provide the size so the item guards can be enforced.
 */
function indexProductOptionSets(
  productOptionSets: ProductOptionSetWithElements[]
): ProductOptionIndex {
  const cache = new Map<number, Map<number, OptionSetInfo>>()
  const requiredSets = new Map<number, Set<number>>()
  const sizeSets = new Map<number, Set<number>>()

  const track = (map: Map<number, Set<number>>, productId: number, setId: number) => {
    if (!map.has(productId)) map.set(productId, new Set())
    map.get(productId)!.add(setId)
  }

  for (const productOptionSet of productOptionSets) {
    const { productId, optionSetId, optionSet } = productOptionSet
    if (!cache.has(productId)) cache.set(productId, new Map())

    const elementsMap = new Map<number, { optionName: string; extraPrice: number }>()
    for (const element of optionSet.elements) {
      elementsMap.set(element.id, {
        optionName: element.label,
        extraPrice: Number(element.priceModifier),
      })
    }
    cache.get(productId)!.set(optionSetId, { groupName: optionSet.name, elementsMap })

    if (productOptionSet.isRequired) track(requiredSets, productId, optionSetId)
    if (optionSet.type === 'size') track(sizeSets, productId, optionSetId)
  }

  return { cache, requiredSets, sizeSets }
}

type OrderForCancel = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: { select: { categoryId: true } } } }
    appliedPromotions: { select: { promotionId: true; discountAmount: true } }
  }
}>

/**
 * Loads an order (scoped to the shop) with everything the cancel/void flow needs.
 * Runs on the transaction client so the read and the subsequent conditional writes
 * are part of the same atomic reversal.
 */
async function loadOrderForCancel(
  tx: Prisma.TransactionClient,
  shopId: number,
  orderId: number
): Promise<OrderForCancel | null> {
  return tx.order.findFirst({
    where: { id: orderId, shopId },
    include: {
      items: { include: { product: { select: { categoryId: true } } } },
      appliedPromotions: { select: { promotionId: true, discountAmount: true } },
    },
  })
}

/** Fetches the given promotions in the exact shape the discount engine expects. */
async function fetchPromotionsForCalc(
  tx: Prisma.TransactionClient,
  promotionIds: number[]
): Promise<PromotionForCalc[]> {
  if (promotionIds.length === 0) return []
  const promotions = await tx.promotion.findMany({
    where: { id: { in: promotionIds } },
    select: {
      id: true,
      discountType: true,
      discountValue: true,
      scope: true,
      categories: { select: { categoryId: true } },
      products: { select: { productId: true } },
    },
  })
  return promotions.map(p => ({
    id: p.id,
    discountType: p.discountType,
    discountValue: Number(p.discountValue),
    scope: p.scope,
    categoryIds: p.categories.map(c => c.categoryId),
    productIds: p.products.map(pr => pr.productId),
  }))
}

/**
 * Core reversal routine shared by whole-order void and single-item cancel. It marks
 * the targeted items cancelled, recomputes the order over the surviving lines
 * (re-running promotions so an invalidated one is dropped, not just subtracted),
 * reconciles promotion redemptions, updates the order's money + status, and writes a
 * reversing (negative) Transaction for the refunded amount. Runs inside the caller's
 * transaction so the whole reversal is atomic.
 */
async function performCancellation(
  tx: Prisma.TransactionClient,
  order: OrderForCancel,
  cancelItemIds: number[],
  actingUserId: number,
  opts: { explicitVoid: boolean; reason?: string | null }
): Promise<void> {
  const now = new Date()

  // 1. Claim the targeted items atomically (whole-line: canceledQuantity = quantity).
  // The `canceledAt: null` guard is what serialises concurrent requests: a second
  // void/cancel of the same line updates 0 rows and aborts, so the money can never be
  // reversed twice (double-click, retry, two devices). Runs inside the transaction.
  const itemsToCancel = order.items.filter(item => cancelItemIds.includes(item.id))
  for (const item of itemsToCancel) {
    const claimed = await tx.orderItem.updateMany({
      where: { id: item.id, orderId: order.id, canceledAt: null },
      data: { canceledAt: now, canceledQuantity: item.quantity },
    })
    if (claimed.count === 0) {
      throw new AppError(Messages.ORDER_ITEM_ALREADY_CANCELED, HttpStatus.BAD_REQUEST)
    }
  }

  // 2. Recompute the money over the surviving (still-live) lines.
  const survivors = order.items.filter(
    item => item.canceledAt == null && !cancelItemIds.includes(item.id)
  )
  const survivingLines: CartLineForCalc[] = survivors.map(item => ({
    productId: item.productId,
    categoryId: item.product.categoryId,
    quantity: item.quantity,
    unitPrice: Number(item.price) + Number(item.extraPrice),
    subtotal: Number(item.subtotal),
  }))
  const orderPromotionIds = order.appliedPromotions.map(ap => ap.promotionId)
  const promotionsForCalc = await fetchPromotionsForCalc(tx, orderPromotionIds)
  const { discountAmount, netTotal, applied } = recalcSurvivorMoney(
    promotionsForCalc,
    survivingLines
  )
  const stillAppliedIds = new Set(applied.map(a => a.promotion.id))

  // 3. Reconcile promotion redemptions. A promotion that no longer applies to any
  // survivor is un-redeemed (counter decremented, breakdown row removed); one that
  // still applies keeps its row with the recomputed discount.
  for (const ap of order.appliedPromotions) {
    const key = { orderId_promotionId: { orderId: order.id, promotionId: ap.promotionId } }
    if (stillAppliedIds.has(ap.promotionId)) {
      const newDiscount = applied.find(a => a.promotion.id === ap.promotionId)!.discount
      await tx.orderPromotion.update({ where: key, data: { discountAmount: newDiscount } })
    } else {
      await tx.orderPromotion.delete({ where: key })
      // Clamp at zero so a double-cancel can never drive the counter negative.
      await tx.promotion.updateMany({
        where: { id: ap.promotionId, timesRedeemed: { gt: 0 } },
        data: { timesRedeemed: { decrement: 1 } },
      })
    }
  }
  const primaryPromotionId = applied.length
    ? applied.reduce((a, b) => (b.discount > a.discount ? b : a)).promotion.id
    : null

  // 4. Whole-order void (explicit, or the last surviving line was just cancelled) →
  // refunded + canceled; otherwise the order is partially refunded and lives on.
  const fullyVoided = opts.explicitVoid || survivors.length === 0
  const oldNet = Number(order.totalAmount)
  const newNet = fullyVoided ? 0 : netTotal

  await tx.order.update({
    where: { id: order.id },
    data: {
      totalAmount: newNet,
      discountAmount: fullyVoided ? 0 : discountAmount,
      promotionId: fullyVoided ? null : primaryPromotionId,
      paymentStatus: fullyVoided ? 'refunded' : 'partially_refunded',
      ...(fullyVoided
        ? {
            fulfillmentStatus: 'canceled',
            voidedAt: now,
            voidedByUserId: actingUserId,
            voidReason: opts.reason ?? null,
          }
        : {}),
    },
  })

  // 5. Reversing payment record — only when money was actually collected (skip unpaid
  // orders so we never refund phantom money). The refund is charged-minus-remaining;
  // for KHR both sides are note-rounded independently so the cash left in the drawer
  // equals the note-rounded remaining total the receipt/history shows.
  const wasPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded'
  if (wasPaid) {
    const rate = Number(order.exchangeRateSnapshot)
    const refundInPaymentCurrency =
      order.paymentCurrency === 'KHR'
        ? roundRielUp(oldNet * rate) - roundRielUp(newNet * rate)
        : round2(Math.max(0, oldNet - newNet))
    if (refundInPaymentCurrency > 0) {
      await tx.transaction.create({
        data: {
          orderId: order.id,
          userId: actingUserId,
          paymentMethod: order.paymentMethod,
          amount: -refundInPaymentCurrency,
          currency: order.paymentCurrency,
          status: 'refunded',
          verifiedAt: now,
        },
      })
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

    // Fetch secure option sets and elements assigned to these products, then index
    // them for validation (price cache + which sets are required + the size sets).
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

    const {
      cache: productOptionsCache,
      requiredSets: requiredSetsByProduct,
      sizeSets: sizeSetsByProduct,
    } = indexProductOptionSets(productOptionSets)

    // ── 2. Server-side price recalculation & Validation ────────────────
    let serverTotal = 0
    const validatedItemsList: Array<{
      productId: number
      quantity: number
      basePrice: number
      optionsExtra: number
      subtotal: number
      isComplimentary: boolean
      compReason: string | null
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

      // A by-size product prices off its size option, so a size-type set must be
      // among the choices (not just any option). No line may total 0 either, which
      // would let a customer be charged nothing for a real item.
      if (product.priceMode === 'by_size') {
        const sizeSetIds = sizeSetsByProduct.get(item.productId)
        const hasSizeChosen = !!sizeSetIds && [...sizeSetIds].some(id => chosenSetIds.has(id))
        if (!hasSizeChosen) {
          throw new AppError(Messages.ORDER_ITEM_PRICE_INVALID, HttpStatus.BAD_REQUEST)
        }
      }
      // A comp line still points at a real, priced product (its price is kept for the
      // receipt), so the price guard applies to it too — only its subtotal is zeroed.
      if (basePrice + optionsExtra <= 0) {
        throw new AppError(Messages.ORDER_ITEM_PRICE_INVALID, HttpStatus.BAD_REQUEST)
      }

      // Complimentary line → subtotal 0, contributing no revenue anywhere. Kept out of
      // serverTotal (and, below, out of the promotion cart — a free line isn't discounted).
      const isComplimentary = item.isComplimentary === true
      const subtotal = isComplimentary ? 0 : (basePrice + optionsExtra) * item.quantity
      serverTotal += subtotal

      validatedItemsList.push({
        productId: item.productId,
        quantity: item.quantity,
        basePrice,
        optionsExtra,
        subtotal,
        isComplimentary,
        // Persist a reason for every comp line (audit trail); default to the only
        // current redemption type so the field is never empty.
        compReason: isComplimentary ? item.compReason?.trim() || 'loyalty stamp' : null,
        validatedOptions,
      })
    }
    serverTotal = Math.round(serverTotal * 100) / 100

    // ── 2b. Server-side promotion application ─────────────────────────
    // Independently fetch the shop's active promotions and recompute the discount
    // here — never trust a client-supplied discount. At most one promotion applies
    // (the largest-discount match). serverTotal is the pre-discount subtotal.
    const cartLines: CartLineForCalc[] = validatedItemsList
      .filter(v => !v.isComplimentary)
      .map(v => ({
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

    // A fully-complimentary order (every line redeemed free) collects no money: it is
    // recorded as `comp` and skips the payment/change flow entirely. The condition is
    // "every line is complimentary" (which inherently makes netTotal 0) rather than
    // "netTotal === 0" — so an order that merely happens to reach 0 via a 100%-off
    // promotion, or a mixed order with a fully-discounted real line, stays a $0 `paid`
    // sale and keeps appearing in sales reports.
    const isFullyComp = validatedItemsList.every(v => v.isComplimentary)

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
    // Guard against a missing/misconfigured rate before it is used in the KHR
    // conversion (a zero or NaN rate would corrupt the amount due and receivedAmountUsd).
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new AppError(Messages.INVALID_EXCHANGE_RATE, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    const fulfillmentStatus = shop.isOrderManagementEnabled !== false ? 'preparing' : 'completed'

    // Amount due in the payment currency. Riel is rounded UP to the nearest 100៛
    // (the smallest note) so the cashier can always collect it.
    const totalInPaymentCurrency =
      paymentCurrency === 'KHR' ? roundRielUp(netTotal * exchangeRate) : round2(netTotal)

    // A fully-comp order is nil-value: nothing is tendered, so the insufficient-payment
    // guard is skipped and the received amount is forced to 0 (no change is due).
    const effectiveReceived = isFullyComp ? 0 : receivedAmount

    if (!isFullyComp && effectiveReceived < totalInPaymentCurrency) {
      throw new AppError(Messages.INSUFFICIENT_PAYMENT, HttpStatus.BAD_REQUEST)
    }

    // ── 4. Calculate change & normalise the received amount to USD ────────
    // Change is rounded DOWN to the nearest 100៛ for riel so only payable notes
    // are returned. receivedAmountUsd lets reports sum every sale in one currency.
    const changeAmount = isFullyComp
      ? 0
      : paymentCurrency === 'KHR'
        ? roundRielDown(effectiveReceived - totalInPaymentCurrency)
        : round2(effectiveReceived - totalInPaymentCurrency)

    const receivedAmountUsd = isFullyComp
      ? 0
      : paymentCurrency === 'KHR'
        ? round2(effectiveReceived / exchangeRate)
        : round2(effectiveReceived)

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
            receivedAmount: effectiveReceived,
            receivedAmountUsd,
            changeAmount,
            paymentCurrency,
            // Persist the server-resolved rate so historical orders reconcile
            // exactly even if the shop later changes its exchange rate.
            exchangeRateSnapshot: exchangeRate,
            paymentMethod,
            // A fully-comp order is `comp` (excluded from paid-only sales queries);
            // otherwise it is a normal paid sale — a mixed order (paid + comp lines)
            // still charges for the paid items and stays `paid`.
            paymentStatus: isFullyComp ? 'comp' : 'paid',
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
              isComplimentary: valItem.isComplimentary,
              compReason: valItem.compReason,
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
      receivedAmount: effectiveReceived,
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
      hasComp?: boolean
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
      hasComp,
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

    // "Free items only" reconciliation filter — restrict to orders carrying at least
    // one complimentary line so the admin can count loyalty-stamp redemptions.
    if (hasComp) {
      whereClause.items = { some: { isComplimentary: true } }
    }

    // Payment status filter. Accepts a comma-separated list (e.g.
    // "paid,partially_refunded") so the sales report can include partially-refunded
    // orders alongside paid ones; a single value still filters exactly (Order History).
    if (paymentStatus) {
      const statuses = paymentStatus
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      if (statuses.length === 1) {
        whereClause.paymentStatus = statuses[0]
      } else if (statuses.length > 1) {
        whereClause.paymentStatus = { in: statuses }
      }
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
        // Who voided the order (shown in the detail panel), and the reversing payment
        // records so the panel can show the refunded amount.
        voidedBy: { select: { id: true, name: true } },
        transactions: {
          select: {
            id: true,
            amount: true,
            currency: true,
            paymentMethod: true,
            status: true,
            verifiedAt: true,
            userId: true,
          },
          orderBy: { id: 'desc' },
        },
      },
    })

    if (!order) {
      throw new AppError(Messages.ORDER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    return order
  },

  async updateOrderStatus(shopId: number, orderId: number, status: string) {
    // 1. Validate status value. Cancelling is NOT a plain status change anymore —
    // it must reverse the money, so it goes through voidOrder, never this endpoint.
    const validStatuses = ['preparing', 'ready', 'completed'] as const
    type FulfillmentTransition = (typeof validStatuses)[number]
    if (!validStatuses.includes(status as FulfillmentTransition)) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    const nextStatus = status as FulfillmentTransition

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

    // A canceled/voided order is terminal — it can't be moved back to an active
    // status, which would silently un-cancel an already-refunded order.
    if (order.fulfillmentStatus === 'canceled') {
      throw new AppError(Messages.ORDER_ALREADY_VOIDED, HttpStatus.BAD_REQUEST)
    }

    // 3. Update fulfillmentStatus
    try {
      const updatedOrder = await prisma.order.update({
        where: {
          id: orderId,
          shopId,
        },
        data: {
          fulfillmentStatus: nextStatus,
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

  /**
   * Voids a whole order: cancels every remaining line, refunds the full remaining
   * amount (reversing Transaction), un-redeems its promotions, and marks the order
   * refunded + canceled. Idempotency guard: an already-voided order is rejected.
   */
  async voidOrder(shopId: number, orderId: number, userId: number, reason?: string) {
    // Load + guard + reverse all inside one transaction so concurrent requests can't
    // both slip past the guard and double-refund (see performCancellation step 1).
    await prisma.$transaction(async tx => {
      const order = await loadOrderForCancel(tx, shopId, orderId)
      if (!order) {
        throw new AppError(Messages.ORDER_NOT_FOUND, HttpStatus.NOT_FOUND)
      }
      if (order.paymentStatus === 'refunded') {
        throw new AppError(Messages.ORDER_ALREADY_VOIDED, HttpStatus.BAD_REQUEST)
      }

      const liveItemIds = order.items.filter(item => item.canceledAt == null).map(item => item.id)
      await performCancellation(tx, order, liveItemIds, userId, {
        explicitVoid: true,
        reason: reason ?? null,
      })
    })

    return orderService.getOrderById(shopId, orderId)
  },

  /**
   * Cancels a single line item, recalculates the order over the survivors (re-running
   * promotions) and refunds the difference. If it was the last live line, the order is
   * fully voided (refunded + canceled) instead of partially refunded.
   */
  async cancelOrderItem(shopId: number, orderId: number, itemId: number, userId: number) {
    // Load + guard + reverse all inside one transaction; the atomic item claim in
    // performCancellation prevents a concurrent double-cancel of the same line.
    await prisma.$transaction(async tx => {
      const order = await loadOrderForCancel(tx, shopId, orderId)
      if (!order) {
        throw new AppError(Messages.ORDER_NOT_FOUND, HttpStatus.NOT_FOUND)
      }
      if (order.paymentStatus === 'refunded') {
        throw new AppError(Messages.ORDER_ALREADY_VOIDED, HttpStatus.BAD_REQUEST)
      }
      const item = order.items.find(i => i.id === itemId)
      if (!item) {
        throw new AppError(Messages.ORDER_ITEM_NOT_FOUND, HttpStatus.NOT_FOUND)
      }
      if (item.canceledAt != null) {
        throw new AppError(Messages.ORDER_ITEM_ALREADY_CANCELED, HttpStatus.BAD_REQUEST)
      }

      await performCancellation(tx, order, [itemId], userId, { explicitVoid: false })
    })

    return orderService.getOrderById(shopId, orderId)
  },
}
