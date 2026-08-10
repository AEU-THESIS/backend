import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateWeightedAverageCost } from '../src/services/inventoryCost'

// Acceptance: 10 kg @ $2.00 then 10 kg @ $3.00 => $2.50/kg
test('averages equal quantities of two prices', () => {
  assert.equal(calculateWeightedAverageCost(10, 2, 10, 3), 2.5)
})

// Acceptance: adding to zero stock adopts the new price (no division-by-zero).
test('zero starting stock adopts the incoming price', () => {
  assert.equal(calculateWeightedAverageCost(0, 0, 10, 3), 3)
})

// Guard: no quantity on either side returns the new cost rather than NaN.
test('guards against division by zero', () => {
  assert.equal(calculateWeightedAverageCost(0, 0, 0, 5), 5)
})

test('weights unequal quantities correctly', () => {
  // (30*1 + 10*5) / 40 = 80/40 = 2
  assert.equal(calculateWeightedAverageCost(30, 1, 10, 5), 2)
})

// Acceptance: a small per-unit cost like $0.018/g survives (not rounded to zero).
test('preserves small per-unit costs', () => {
  assert.equal(calculateWeightedAverageCost(100, 0.018, 100, 0.018), 0.018)
})
