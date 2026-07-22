/**
 * Promotion discount calculation — the single source of truth for how an active
 * promotion reduces a cart. The frontend cart store mirrors this exact logic so
 * the amount shown to the cashier matches what the server persists at checkout.
 *
 * Model: at most one promotion applies per order — the active promotion that
 * produces the largest discount for the cart's in-scope lines.
 *
 * Discount types:
 *  - PERCENTAGE   → value% off the in-scope subtotal
 *  - FIXED_AMOUNT → a flat amount off the in-scope subtotal (capped at it)
 *  - BOGO         → "Buy 1 Get 1": for every 2 in-scope units, the cheaper unit
 *                   is free (needs at least 2 eligible units to trigger)
 */

export interface PromotionForCalc {
  id: number
  discountType: string // PERCENTAGE | FIXED_AMOUNT | BOGO
  discountValue: number
  scope: string // ALL | SPECIFIC
  categoryIds: number[]
  productIds: number[]
}

export interface CartLineForCalc {
  productId: number
  categoryId: number
  quantity: number
  unitPrice: number // base price + option extras, for a single unit
  subtotal: number // unitPrice * quantity
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Whether a cart line falls within a promotion's scope. */
export const isLineInScope = (promo: PromotionForCalc, line: CartLineForCalc): boolean =>
  promo.scope === 'ALL' ||
  promo.productIds.includes(line.productId) ||
  promo.categoryIds.includes(line.categoryId)

/**
 * BOGO discount: expand the in-scope lines into individual units, then make the
 * cheapest half free (one free unit per pair). Freeing the cheaper unit of each
 * pair is the customer-friendly convention used by most "Buy 1 Get 1" campaigns.
 */
const bogoDiscount = (lines: CartLineForCalc[]): number => {
  // Expand each line into its individual units, then sort cheapest-first.
  const units = lines
    .flatMap(line => Array(line.quantity).fill(line.unitPrice) as number[])
    .sort((a, b) => a - b)
  if (units.length < 2) return 0
  const freeCount = Math.floor(units.length / 2)
  return units.slice(0, freeCount).reduce((sum, price) => sum + price, 0)
}

/** Discount a single promotion would apply to the given cart lines (0 if none). */
export const promotionDiscount = (promo: PromotionForCalc, lines: CartLineForCalc[]): number => {
  const inScope = lines.filter(line => isLineInScope(promo, line))
  const base = inScope.reduce((sum, line) => sum + line.subtotal, 0)

  if (base <= 0) return 0

  let discount = 0
  if (promo.discountType === 'PERCENTAGE') {
    discount = base * (promo.discountValue / 100)
  } else if (promo.discountType === 'FIXED_AMOUNT') {
    discount = Math.min(promo.discountValue, base)
  } else if (promo.discountType === 'BOGO') {
    discount = bogoDiscount(inScope)
  }

  return round2(Math.min(discount, base))
}

/** The best (largest-discount) applicable promotion for the cart, or null. */
export const bestPromotion = (
  promos: PromotionForCalc[],
  lines: CartLineForCalc[]
): { promotion: PromotionForCalc; discount: number } | null => {
  let best: { promotion: PromotionForCalc; discount: number } | null = null
  for (const promo of promos) {
    const discount = promotionDiscount(promo, lines)
    if (discount > 0 && (best === null || discount > best.discount)) {
      best = { promotion: promo, discount }
    }
  }
  return best
}

export interface AppliedPromotion {
  promotion: PromotionForCalc
  discount: number
}

/**
 * All discounts that apply to a cart. Different items can carry different
 * promotions, so those stack: each SPECIFIC-scope promotion discounts its own
 * in-scope items (an item belongs to at most one such promotion — the first to
 * claim it wins, guaranteeing no double-counting). ALL-scope promotions then
 * compete for whatever is left over — the single best one applies to the
 * remaining lines. Returns every applied promotion plus the summed total.
 */
export const cartDiscounts = (
  promos: PromotionForCalc[],
  lines: CartLineForCalc[]
): { total: number; applied: AppliedPromotion[] } => {
  const applied: AppliedPromotion[] = []
  const coveredIdx = new Set<number>()

  for (const promo of promos) {
    if (promo.scope !== 'SPECIFIC') continue
    const scoped = lines.filter((line, i) => !coveredIdx.has(i) && isLineInScope(promo, line))
    if (scoped.length === 0) continue
    const discount = promotionDiscount(promo, scoped)
    if (discount > 0) {
      applied.push({ promotion: promo, discount })
      for (const [i, line] of lines.entries()) {
        if (isLineInScope(promo, line)) coveredIdx.add(i)
      }
    }
  }

  const remaining = lines.filter((_, i) => !coveredIdx.has(i))
  let bestAll: AppliedPromotion | null = null
  for (const promo of promos) {
    if (promo.scope !== 'ALL') continue
    const discount = promotionDiscount(promo, remaining)
    if (discount > 0 && (bestAll === null || discount > bestAll.discount)) {
      bestAll = { promotion: promo, discount }
    }
  }
  if (bestAll) applied.push(bestAll)

  const total = round2(applied.reduce((sum, a) => sum + a.discount, 0))
  return { total, applied }
}
