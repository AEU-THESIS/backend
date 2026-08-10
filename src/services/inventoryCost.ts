/**
 * Pure inventory-costing helpers. Kept free of Prisma/other imports so the
 * weighted-average formula can be unit-tested in isolation.
 */

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
  oldQty: number,
  oldCost: number,
  addQty: number,
  newCost: number
): number => {
  const totalQty = oldQty + addQty
  if (totalQty <= 0) return newCost
  return (oldQty * oldCost + addQty * newCost) / totalQty
}
