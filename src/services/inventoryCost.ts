/**
 * Pure inventory-costing helpers. Kept free of Prisma-client *queries* so the
 * weighted-average formula can be unit-tested in isolation.
 *
 * All arithmetic runs on `Prisma.Decimal` (decimal.js) rather than `number`.
 * Binary floating point cannot represent most decimal fractions exactly, so a
 * `number` pipeline can land on the wrong 4th decimal place: averaging 0.01 at
 * 1.0151 with 0.01 at 1.025 is exactly 1.02005, which must round to 1.0201, but
 * the float result rounds to 1.0200. Stock is DECIMAL(10,2) and cost is
 * DECIMAL(12,4), so their product can also exceed Number.MAX_SAFE_INTEGER and
 * lose cents during valuation.
 */
import { Prisma } from '@prisma/client'

/** Anything Prisma hands back for a Decimal column, or a plain input value. */
export type DecimalLike = Prisma.Decimal | string | number

/** Scale of the quantity columns (`current_stock`, `quantity_changed`). */
export const QUANTITY_SCALE = 2
/** Scale of the cost columns (`unit_cost`, `last_unit_cost`). */
export const COST_SCALE = 4
/** Scale used for money returned to clients. */
export const MONEY_SCALE = 2

export const toDecimal = (value: DecimalLike): Prisma.Decimal => new Prisma.Decimal(value)

/** Half-up rounding, matching how MySQL rounds a DECIMAL on write. */
export const roundTo = (value: DecimalLike, scale: number): Prisma.Decimal =>
  toDecimal(value).toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP)

export const roundMoney = (value: DecimalLike): Prisma.Decimal => roundTo(value, MONEY_SCALE)
export const roundCost = (value: DecimalLike): Prisma.Decimal => roundTo(value, COST_SCALE)

/**
 * Rolls an item's cost forward when stock is added, as the quantity-weighted
 * average of the existing stock and the incoming purchase:
 *
 *   (oldQty * oldCost + addQty * newCost) / (oldQty + addQty)
 *
 * Guards against division by zero: if the resulting total quantity is not
 * positive (e.g. adding to an empty item), the new purchase price is used as-is.
 */
export const calculateWeightedAverageCost = (
  oldQty: DecimalLike,
  oldCost: DecimalLike,
  addQty: DecimalLike,
  newCost: DecimalLike
): Prisma.Decimal => {
  const quantity = toDecimal(oldQty)
  const cost = toDecimal(oldCost)
  const incomingQuantity = toDecimal(addQty)
  const incomingCost = toDecimal(newCost)

  const totalQuantity = quantity.plus(incomingQuantity)
  if (totalQuantity.lessThanOrEqualTo(0)) return incomingCost

  return quantity.times(cost).plus(incomingQuantity.times(incomingCost)).dividedBy(totalQuantity)
}
