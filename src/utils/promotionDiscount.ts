/**
 * Promotion discount calculation — the single source of truth for how an active
 * promotion reduces a cart. The frontend cart store mirrors this exact logic so
 * the amount shown to the cashier matches what the server persists at checkout.
 *
 * Model: at most one promotion applies per order — the active promotion that
 * produces the largest discount for the cart's in-scope lines.
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
  subtotal: number // (base price + option extras) * quantity
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Whether a cart line falls within a promotion's scope. */
export const isLineInScope = (promo: PromotionForCalc, line: CartLineForCalc): boolean =>
  promo.scope === 'ALL' ||
  promo.productIds.includes(line.productId) ||
  promo.categoryIds.includes(line.categoryId)

/** Discount a single promotion would apply to the given cart lines (0 if none). */
export const promotionDiscount = (promo: PromotionForCalc, lines: CartLineForCalc[]): number => {
  const base = lines
    .filter(line => isLineInScope(promo, line))
    .reduce((sum, line) => sum + line.subtotal, 0)

  if (base <= 0) return 0

  let discount = 0
  if (promo.discountType === 'PERCENTAGE') {
    discount = base * (promo.discountValue / 100)
  } else if (promo.discountType === 'FIXED_AMOUNT') {
    discount = Math.min(promo.discountValue, base)
  } else {
    // BOGO is configured in the back office but not auto-applied in cart math
    // (out of scope for the Percentage/Fixed cart calculation).
    discount = 0
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
