import { describe, it, expect } from 'vitest'
import {
  promotionDiscount,
  cartDiscounts,
  recalcSurvivorMoney,
  type PromotionForCalc,
  type CartLineForCalc,
} from './promotionDiscount'

// ── Fixtures ────────────────────────────────────────────────────────────────
const bogoAll: PromotionForCalc = {
  id: 1,
  discountType: 'BOGO',
  discountValue: 0,
  scope: 'ALL',
  categoryIds: [],
  productIds: [],
}
const fixed5All: PromotionForCalc = {
  id: 2,
  discountType: 'FIXED_AMOUNT',
  discountValue: 5,
  scope: 'ALL',
  categoryIds: [],
  productIds: [],
}
const pct20All: PromotionForCalc = {
  id: 3,
  discountType: 'PERCENTAGE',
  discountValue: 20,
  scope: 'ALL',
  categoryIds: [],
  productIds: [],
}

// A single-unit cart line. subtotal defaults to unitPrice * quantity.
const line = (
  productId: number,
  unitPrice: number,
  quantity = 1,
  categoryId = 1
): CartLineForCalc => ({
  productId,
  categoryId,
  quantity,
  unitPrice,
  subtotal: unitPrice * quantity,
})

const latte = line(10, 3) // $3.00
const mocha = line(11, 4) // $4.00

// ── The discount engine itself (the piece re-run on cancellation) ────────────
describe('promotionDiscount', () => {
  it('BOGO frees the cheaper unit of each pair', () => {
    // Two units (3 + 4) → one free → the cheaper (3) comes off.
    expect(promotionDiscount(bogoAll, [latte, mocha])).toBe(3)
  })

  it('BOGO needs at least two eligible units, otherwise no discount', () => {
    expect(promotionDiscount(bogoAll, [latte])).toBe(0)
  })

  it('FIXED_AMOUNT is capped at the in-scope subtotal', () => {
    expect(promotionDiscount(fixed5All, [latte, mocha])).toBe(5) // min(5, 7)
    expect(promotionDiscount(fixed5All, [latte])).toBe(3) // min(5, 3)
  })
})

// ── recalcSurvivorMoney: the cancellation recalculation ──────────────────────
describe('recalcSurvivorMoney (order recalculated after a cancellation)', () => {
  it('drops a BOGO discount when a cancel leaves fewer than two units', () => {
    const before = recalcSurvivorMoney([bogoAll], [latte, mocha])
    expect(before).toMatchObject({ subtotal: 7, discountAmount: 3, netTotal: 4 })
    expect(before.applied).toHaveLength(1)

    // Cancel the mocha → only the latte survives → BOGO no longer valid.
    const after = recalcSurvivorMoney([bogoAll], [latte])
    expect(after).toMatchObject({ subtotal: 3, discountAmount: 0, netTotal: 3 })
    expect(after.applied).toHaveLength(0)
  })

  it('re-caps a FIXED_AMOUNT discount against the reduced subtotal', () => {
    const before = recalcSurvivorMoney([fixed5All], [latte, mocha])
    expect(before).toMatchObject({ subtotal: 7, discountAmount: 5, netTotal: 2 })

    // Cancel the mocha → subtotal 3 → the $5 promo re-caps to $3 → net $0.
    const after = recalcSurvivorMoney([fixed5All], [latte])
    expect(after).toMatchObject({ subtotal: 3, discountAmount: 3, netTotal: 0 })
  })

  it('recomputes a PERCENTAGE discount over the survivors', () => {
    const after = recalcSurvivorMoney([pct20All], [latte])
    // 20% of $3.00 = $0.60 → net $2.40 (rounded to cents).
    expect(after).toMatchObject({ subtotal: 3, discountAmount: 0.6, netTotal: 2.4 })
  })

  it('returns zero money when every line has been cancelled', () => {
    const empty = recalcSurvivorMoney([bogoAll, fixed5All], [])
    expect(empty).toMatchObject({ subtotal: 0, discountAmount: 0, netTotal: 0 })
    expect(empty.applied).toHaveLength(0)
  })

  it('keeps a still-valid SPECIFIC promo but drops an ALL promo whose items are gone', () => {
    const p10 = line(10, 5)
    const p11 = line(11, 5, 1, 2) // different category
    const specificToP10: PromotionForCalc = {
      id: 20,
      discountType: 'FIXED_AMOUNT',
      discountValue: 2,
      scope: 'SPECIFIC',
      categoryIds: [],
      productIds: [10],
    }
    const promos = [specificToP10, pct20All]

    // Both apply before the cancel: $2 off p10 (specific) + 20% of the remaining p11.
    const before = cartDiscounts(promos, [p10, p11])
    expect(before.applied).toHaveLength(2)

    // Cancel p11 → only p10 survives → the ALL promo has nothing left to discount.
    const after = recalcSurvivorMoney(promos, [p10])
    expect(after.applied).toHaveLength(1)
    expect(after.applied[0].promotion.id).toBe(specificToP10.id)
    expect(after).toMatchObject({ subtotal: 5, discountAmount: 2, netTotal: 3 })
  })
})
