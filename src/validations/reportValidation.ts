import { z } from 'zod'

export const ReportPeriodSchema = z.strictObject({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  type: z.enum(['sales', 'inventory']).default('sales'),
})

export type ReportPeriodInput = z.infer<typeof ReportPeriodSchema>

const calendarDate = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be in YYYY-MM-DD format`)
    .refine(val => {
      const [year, month, day] = val.split('-').map(Number)
      const parsed = new Date(Date.UTC(year, month - 1, day))
      return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      )
    }, `${label} must be a valid calendar date`)

export const DailySummaryQuerySchema = z
  .strictObject({
    date: calendarDate('Date').optional(),
    /** Widens the summary to the inclusive window [date, endDate]. */
    endDate: calendarDate('End date').optional(),
  })
  // `endDate` only means something relative to `date`; on its own the window
  // would silently start at today and could end before it.
  .refine(data => !data.endDate || !!data.date, {
    message: 'endDate requires date',
    path: ['endDate'],
  })
  .refine(data => !data.endDate || !data.date || data.endDate >= data.date, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })

export type DailySummaryQueryInput = z.infer<typeof DailySummaryQuerySchema>
// Optional inclusive [startDate, endDate] window (ISO 8601) shared by the
// analytics endpoints. When supplied it overrides the endpoint's preset
// period/range, letting the dashboard's global filter drive every widget.
const dateRangeFields = {
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}

const requireBothOrNeitherDate = <T extends { startDate?: string; endDate?: string }>(data: T) =>
  !!data.startDate === !!data.endDate

export const ItemPerformanceSchema = z
  .strictObject({
    type: z.enum(['top', 'bottom']).default('top'),
    period: z.enum(['thisWeek', 'thisMonth', 'thisYear', 'specific']).default('thisWeek'),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
      .optional(),
    ...dateRangeFields,
  })
  .refine(data => data.period !== 'specific' || !!data.month || !!data.startDate, {
    message: 'month is required when period is "specific"',
    path: ['month'],
  })
  .refine(requireBothOrNeitherDate, {
    message: 'startDate and endDate must be provided together',
    path: ['endDate'],
  })

export type ItemPerformanceInput = z.infer<typeof ItemPerformanceSchema>

export const KpiSummarySchema = z
  .strictObject({
    range: z.enum(['today', 'yesterday', 'last7', 'monthly', 'yearly', 'custom']).default('today'),
    ...dateRangeFields,
  })
  .refine(data => data.range !== 'custom' || (!!data.startDate && !!data.endDate), {
    message: 'startDate and endDate are required when range is "custom"',
    path: ['startDate'],
  })

export type KpiSummaryInput = z.infer<typeof KpiSummarySchema>

export const SalesTrendSchema = z
  .strictObject({
    granularity: z.enum(['weekly', 'monthly', 'yearly']).default('weekly'),
    ...dateRangeFields,
  })
  .refine(requireBothOrNeitherDate, {
    message: 'startDate and endDate must be provided together',
    path: ['endDate'],
  })

export type SalesTrendInput = z.infer<typeof SalesTrendSchema>

export const SalesSummaryExportSchema = z
  .strictObject({
    startDate: calendarDate('Start date'),
    endDate: calendarDate('End date'),
  })
  .refine(data => data.startDate <= data.endDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  })
  .refine(
    data =>
      (Date.parse(`${data.endDate}T00:00:00Z`) - Date.parse(`${data.startDate}T00:00:00Z`)) /
        86_400_000 <=
      366,
    { message: 'Date range must not exceed 366 days', path: ['endDate'] }
  )

export type SalesSummaryExportInput = z.infer<typeof SalesSummaryExportSchema>
