/**
 * Money rounding helpers. These are the single source of truth for how amounts
 * are rounded across the backend, and are mirrored on the frontend
 * (`frontend/src/utils/money.ts`) so the POS displays exactly what the server
 * charges.
 *
 * - `round2`      — round to 2 decimal places (USD cents).
 * - `roundRielUp` — round a KHR amount UP to the nearest 100៛; used for the
 *                   amount DUE so a customer can never underpay.
 * - `roundRielDown` — round a KHR amount DOWN to the nearest 100៛; used for
 *                   CHANGE so the drawer only ever gives out payable notes.
 *
 * 100៛ is the smallest note in circulation, so amounts are never quoted or
 * returned in denominations the cashier cannot physically hand over.
 */

const RIEL_NOTE = 100

export function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function roundRielUp(amount: number): number {
  return Math.ceil(amount / RIEL_NOTE) * RIEL_NOTE
}

export function roundRielDown(amount: number): number {
  return Math.floor(amount / RIEL_NOTE) * RIEL_NOTE
}
