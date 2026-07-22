/**
 * Timezone the café operates in. Order timestamps are stored in UTC, but
 * "today"/"yesterday"/date-range filters must be evaluated against the café's
 * *local* calendar day. Cambodia (Asia/Phnom_Penh) is a fixed UTC+7 with no
 * DST, so a constant offset is both correct and dependency-free. Overridable
 * via env for other deployments.
 */
// Use the configured offset when it's a valid number (including 0 for UTC);
// only fall back to UTC+7 when it's unset or non-numeric.
const configuredOffset = Number(process.env.SHOP_UTC_OFFSET_MINUTES)
const SHOP_UTC_OFFSET_MINUTES = Number.isFinite(configuredOffset) ? configuredOffset : 420 // UTC+7

/**
 * Returns the UTC instant at the *start* (00:00:00.000) of the given local
 * calendar day in the shop's timezone. Accepts a `YYYY-MM-DD` string (any
 * trailing time portion is ignored).
 *
 * e.g. shopDayStartUtc('2026-07-22') with UTC+7 → 2026-07-21T17:00:00.000Z
 */
export function shopDayStartUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number)
  // Build the wall-clock instant as if it were UTC, then shift back by the
  // shop offset to get the true UTC instant of that local midnight.
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - SHOP_UTC_OFFSET_MINUTES * 60_000)
}

/**
 * Returns the UTC instant at the *end* (23:59:59.999) of the given local
 * calendar day in the shop's timezone.
 *
 * e.g. shopDayEndUtc('2026-07-22') with UTC+7 → 2026-07-22T16:59:59.999Z
 */
export function shopDayEndUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) - SHOP_UTC_OFFSET_MINUTES * 60_000
  )
}

/**
 * The current calendar date (`YYYY-MM-DD`) in the shop's timezone, independent
 * of the server's own timezone.
 * @param dayOffset days to add/subtract (e.g. -1 for "yesterday").
 */
export function shopDateString(dayOffset = 0): string {
  const shopNow = new Date(Date.now() + SHOP_UTC_OFFSET_MINUTES * 60_000)
  shopNow.setUTCDate(shopNow.getUTCDate() + dayOffset)
  const year = shopNow.getUTCFullYear()
  const month = String(shopNow.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shopNow.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculates the start date based on the specified period.
 */
export function getPeriodStartDate(period: 'daily' | 'weekly' | 'monthly'): Date {
  const date = new Date()
  if (period === 'daily') {
    date.setHours(0, 0, 0, 0)
  } else if (period === 'weekly') {
    date.setDate(date.getDate() - 7)
    date.setHours(0, 0, 0, 0)
  } else if (period === 'monthly') {
    const originalDay = date.getDate()
    date.setDate(1) // Avoid overflow when decrementing
    date.setMonth(date.getMonth() - 1)
    const daysInPreviousMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    date.setDate(Math.min(originalDay, daysInPreviousMonth))
    date.setHours(0, 0, 0, 0)
  }
  return date
}
