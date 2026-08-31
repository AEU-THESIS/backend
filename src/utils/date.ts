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
  // "now" is an absolute instant, correct regardless of timezone; every *day*
  // boundary below is the shop's local calendar day, not the server's.
  const end = new Date()
  const today = shopDateString(0)

  if (period === 'thisWeek') {
    const mondayOffset = (shopNowParts().weekday + 6) % 7 // Sunday(0) → 6, Monday(1) → 0
    return { start: shopDayStartUtc(shiftDateString(today, -mondayOffset)), end }
  }

  if (period === 'thisMonth') {
    return { start: shopDayStartUtc(shopMonthFirst(0)), end }
  }

  if (period === 'thisYear') {
    return { start: shopDayStartUtc(`${shopNowParts().year}-01-01`), end }
  }

  // specific: a single "YYYY-MM" month, from its first to last shop-local day.
  const [year, monthNum] = (month ?? '').split('-').map(Number)
  const mm = String(monthNum).padStart(2, '0')
  const lastDay = String(daysInMonth(year, monthNum)).padStart(2, '0')
  return {
    start: shopDayStartUtc(`${year}-${mm}-01`),
    end: shopDayEndUtc(`${year}-${mm}-${lastDay}`),
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
  // Windows are anchored to the shop's local calendar day; `now` stays an
  // absolute instant so the current partial day runs up to the present moment.
  const now = new Date()
  const today = shopDateString(0)

  if (range === 'today') {
    const prevDay = shiftDateString(today, -1)
    return {
      start: shopDayStartUtc(today),
      end: now,
      prevStart: shopDayStartUtc(prevDay),
      prevEnd: shopDayEndUtc(prevDay),
    }
  }

  if (range === 'yesterday') {
    const day = shiftDateString(today, -1)
    const prevDay = shiftDateString(today, -2)
    return {
      start: shopDayStartUtc(day),
      end: shopDayEndUtc(day),
      prevStart: shopDayStartUtc(prevDay),
      prevEnd: shopDayEndUtc(prevDay),
    }
  }

  if (range === 'last7') {
    // Inclusive 7-day window (today and the six days before it), compared with
    // the seven days immediately preceding that.
    return {
      start: shopDayStartUtc(shiftDateString(today, -6)),
      end: now,
      prevStart: shopDayStartUtc(shiftDateString(today, -13)),
      prevEnd: shopDayEndUtc(shiftDateString(today, -7)),
    }
  }

  if (range === 'yearly') {
    // year-to-date vs the same span of the previous year.
    const { year } = shopNowParts()
    const dayOfYear = daysBetween(`${year}-01-01`, today)
    return {
      start: shopDayStartUtc(`${year}-01-01`),
      end: now,
      prevStart: shopDayStartUtc(`${year - 1}-01-01`),
      prevEnd: shopDayEndUtc(shiftDateString(`${year - 1}-01-01`, dayOfYear)),
    }
  }

  if (range === 'custom') {
    // Explicit window: the caller already supplies absolute start/end instants.
    const start = new Date(startDate as string)
    const end = new Date(endDate as string)
    // Previous window: same duration, ending the instant before `start`.
    const spanMs = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - spanMs)
    return { start, end, prevStart, prevEnd }
  }

  // monthly: month-to-date vs the same span of the previous month.
  const first = shopMonthFirst(0)
  const prevFirst = shopMonthFirst(-1)
  const dayOfMonth = daysBetween(first, today) // 0-based offset into the month
  return {
    start: shopDayStartUtc(first),
    end: now,
    prevStart: shopDayStartUtc(prevFirst),
    prevEnd: shopDayEndUtc(shiftDateString(prevFirst, dayOfMonth)),
  }
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
  // Work entirely in the shop's wall clock: shifting an instant by the shop
  // offset lets the UTC getters read the shop's local Y/M/D/H, so buckets and
  // the labels on them line up with the shop's calendar (not the server's).
  const s = toShopWallClock(start)
  const e = toShopWallClock(end)
  const startOfDayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const spanDays = (e.getTime() - s.getTime()) / dayMs
  const points: { label: string; value: number }[] = []

  if (spanDays <= 1.5) {
    const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`
    for (let h = 0; h < 24; h++) points.push({ label: hourLabel(h), value: 0 })
    return { points, bucketIndex: d => toShopWallClock(d).getUTCHours() }
  }

  if (spanDays <= 31) {
    const s0 = startOfDayMs(s)
    const days = Math.floor((startOfDayMs(e) - s0) / dayMs) + 1
    for (let i = 0; i < days; i++) {
      const d = new Date(s0 + i * dayMs)
      points.push({ label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, value: 0 })
    }
    return {
      points,
      bucketIndex: d => Math.floor((startOfDayMs(toShopWallClock(d)) - s0) / dayMs),
    }
  }

  if (spanDays <= 92) {
    // Monday-aligned weeks.
    const mondayOffset = (new Date(startOfDayMs(s)).getUTCDay() + 6) % 7
    const s0 = startOfDayMs(s) - mondayOffset * dayMs
    const weeks = Math.floor((startOfDayMs(e) - s0) / (dayMs * 7)) + 1
    for (let i = 0; i < weeks; i++) {
      const d = new Date(s0 + i * 7 * dayMs)
      points.push({ label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, value: 0 })
    }
    return {
      points,
      bucketIndex: d => Math.floor((startOfDayMs(toShopWallClock(d)) - s0) / (dayMs * 7)),
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
      (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1
    for (let i = 0; i < count; i++) {
      const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + i, 1))
      points.push({ label: months[d.getUTCMonth()], value: 0 })
    }
    return {
      points,
      bucketIndex: d => {
        const w = toShopWallClock(d)
        return (w.getUTCFullYear() - s.getUTCFullYear()) * 12 + (w.getUTCMonth() - s.getUTCMonth())
      },
    }
  }

  for (let y = s.getUTCFullYear(); y <= e.getUTCFullYear(); y++) {
    points.push({ label: String(y), value: 0 })
  }
  return { points, bucketIndex: d => toShopWallClock(d).getUTCFullYear() - s.getUTCFullYear() }
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

/** Year / month (1-12) / day / weekday (0=Sun) of "now" in the shop's calendar. */
function shopNowParts(): { year: number; month: number; day: number; weekday: number } {
  const shopNow = new Date(Date.now() + SHOP_UTC_OFFSET_MINUTES * 60_000)
  return {
    year: shopNow.getUTCFullYear(),
    month: shopNow.getUTCMonth() + 1,
    day: shopNow.getUTCDate(),
    weekday: shopNow.getUTCDay(),
  }
}

/** Number of days in the given calendar month (month is 1-12). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Shifts a `YYYY-MM-DD` string by whole days, returning a `YYYY-MM-DD` string. */
function shiftDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000)
  const yy = shifted.getUTCFullYear()
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shifted.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Whole days from `fromStr` to `toStr` (both `YYYY-MM-DD`); non-negative when to ≥ from. */
function daysBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = toStr.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** `YYYY-MM-01` for the shop-local month `monthOffset` months from the current one. */
function shopMonthFirst(monthOffset = 0): string {
  const { year, month } = shopNowParts()
  const idx = year * 12 + (month - 1) + monthOffset
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}-01`
}

/**
 * The shop-local calendar date (`YYYY-MM-DD`) a UTC instant falls on. Use this to
 * bucket stored timestamps into local days (an order placed just after local
 * midnight belongs to the new day, not the server's).
 */
export function toShopDateString(date: Date): string {
  const shopTime = new Date(date.getTime() + SHOP_UTC_OFFSET_MINUTES * 60_000)
  const year = shopTime.getUTCFullYear()
  const month = String(shopTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shopTime.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Shifts a UTC instant so that reading it with `timeZone: 'UTC'` yields the
 * shop's own wall clock. Lets `Intl.DateTimeFormat` render a timestamp in the
 * café's local time without needing an IANA zone name for the configured
 * offset.
 */
export function toShopWallClock(date: Date): Date {
  return new Date(date.getTime() + SHOP_UTC_OFFSET_MINUTES * 60_000)
}

/**
 * Calculates the start instant (shop-local midnight) for the specified period:
 *   daily   → the start of the shop's today
 *   weekly  → the start of the shop's day seven days ago
 *   monthly → the start of the same day-of-month one month ago (clamped)
 * The window runs from this instant up to now, evaluated against the shop's
 * calendar day rather than the server's timezone.
 */
export function getPeriodStartDate(period: 'daily' | 'weekly' | 'monthly'): Date {
  const today = shopDateString(0)

  if (period === 'weekly') {
    return shopDayStartUtc(shiftDateString(today, -7))
  }

  if (period === 'monthly') {
    const { year, month, day } = shopNowParts()
    const idx = year * 12 + (month - 1) - 1 // previous month
    const py = Math.floor(idx / 12)
    const pm = (idx % 12) + 1
    const clampedDay = Math.min(day, daysInMonth(py, pm))
    const dateStr = `${py}-${String(pm).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
    return shopDayStartUtc(dateStr)
  }

  // daily
  return shopDayStartUtc(today)
}
