export type ItemReportPeriod = 'thisWeek' | 'thisMonth' | 'thisYear' | 'specific'

/**
 * Resolves an inclusive [start, end] date range for the item-performance report.
 *
 * - thisWeek : Monday 00:00 of the current week → now
 * - thisMonth: 1st of the current month → now
 * - thisYear : Jan 1st of the current year → now
 * - specific : full calendar month passed as "YYYY-MM" (month/year granularity only)
 */
export function getItemReportRange(
  period: ItemReportPeriod,
  month?: string
): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date()

  if (period === 'thisWeek') {
    const start = new Date(now)
    const mondayOffset = (start.getDay() + 6) % 7 // Sunday(0) → 6, Monday(1) → 0
    start.setDate(start.getDate() - mondayOffset)
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }

  if (period === 'thisMonth') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), end }
  }

  if (period === 'thisYear') {
    return { start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), end }
  }

  // specific: a single "YYYY-MM" month, from its first to last day.
  const [year, monthNum] = (month ?? '').split('-').map(Number)
  return {
    start: new Date(year, monthNum - 1, 1, 0, 0, 0, 0),
    end: new Date(year, monthNum, 0, 23, 59, 59, 999),
  }
}

export type KpiRange = 'today' | 'yesterday' | 'last7' | 'monthly' | 'yearly' | 'custom'

/**
 * Resolves the current window plus the immediately-preceding comparison window
 * for a KPI range, enabling period-over-period trend calculations.
 *
 * For `custom`, `startDate`/`endDate` (inclusive) are required and the previous
 * window is the equally-long span immediately preceding the selected one.
 */
export function getKpiRange(
  range: KpiRange,
  startDate?: string,
  endDate?: string
): {
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
} {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  const addDays = (d: Date, n: number) => {
    const copy = new Date(d)
    copy.setDate(copy.getDate() + n)
    return copy
  }

  if (range === 'today') {
    const prevStart = addDays(startOfToday, -1)
    return { start: startOfToday, end: now, prevStart, prevEnd: endOfDay(prevStart) }
  }

  if (range === 'yesterday') {
    const start = addDays(startOfToday, -1)
    const prevStart = addDays(startOfToday, -2)
    return { start, end: endOfDay(start), prevStart, prevEnd: endOfDay(prevStart) }
  }

  if (range === 'last7') {
    const start = addDays(startOfToday, -6)
    const prevStart = addDays(startOfToday, -13)
    const prevEnd = endOfDay(addDays(startOfToday, -7))
    return { start, end: now, prevStart, prevEnd }
  }

  if (range === 'yearly') {
    // year-to-date vs the same span of the previous year.
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    const prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    const prevEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { start, end: now, prevStart, prevEnd }
  }

  if (range === 'custom') {
    const start = new Date(startDate as string)
    const end = new Date(endDate as string)
    // Previous window: same duration, ending the instant before `start`.
    const spanMs = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - spanMs)
    return { start, end, prevStart, prevEnd }
  }

  // monthly: month-to-date vs the same span of the previous month.
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
  const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59, 59, 999)
  return { start, end: now, prevStart, prevEnd }
}

/**
 * Builds an ordered set of `{ label, value: 0 }` buckets spanning an inclusive
 * [start, end] date range, plus an index function mapping a date to its bucket.
 * The bucket size adapts to the span so the chart stays readable:
 *   ≤ ~1 day  → hourly    (24 buckets)
 *   ≤ 31 days → daily
 *   ≤ 92 days → weekly    (Monday-aligned)
 *   ≤ 366 days→ monthly
 *   otherwise → yearly
 * Aggregation is performed in JS by callers to stay database-dialect independent.
 */
export function buildRangeBuckets(
  start: Date,
  end: Date
): { points: { label: string; value: number }[]; bucketIndex: (d: Date) => number } {
  const dayMs = 86400000
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const spanDays = (end.getTime() - start.getTime()) / dayMs
  const points: { label: string; value: number }[] = []

  if (spanDays <= 1.5) {
    const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`
    for (let h = 0; h < 24; h++) points.push({ label: hourLabel(h), value: 0 })
    return { points, bucketIndex: d => d.getHours() }
  }

  if (spanDays <= 31) {
    const s = startOfDay(start)
    const days = Math.floor((startOfDay(end).getTime() - s.getTime()) / dayMs) + 1
    for (let i = 0; i < days; i++) {
      const d = new Date(s)
      d.setDate(s.getDate() + i)
      points.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0 })
    }
    return {
      points,
      bucketIndex: d => Math.floor((startOfDay(d).getTime() - s.getTime()) / dayMs),
    }
  }

  if (spanDays <= 92) {
    // Monday-aligned weeks.
    const s = startOfDay(start)
    const mondayOffset = (s.getDay() + 6) % 7
    s.setDate(s.getDate() - mondayOffset)
    const weeks = Math.floor((startOfDay(end).getTime() - s.getTime()) / (dayMs * 7)) + 1
    for (let i = 0; i < weeks; i++) {
      const d = new Date(s)
      d.setDate(s.getDate() + i * 7)
      points.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0 })
    }
    return {
      points,
      bucketIndex: d => Math.floor((startOfDay(d).getTime() - s.getTime()) / (dayMs * 7)),
    }
  }

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  if (spanDays <= 366) {
    const count =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
    for (let i = 0; i < count; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      points.push({ label: months[d.getMonth()], value: 0 })
    }
    return {
      points,
      bucketIndex: d =>
        (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth()),
    }
  }

  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    points.push({ label: String(y), value: 0 })
  }
  return { points, bucketIndex: d => d.getFullYear() - start.getFullYear() }
}

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
