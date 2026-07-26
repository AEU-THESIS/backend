import { z } from 'zod'

export const ReportPeriodSchema = z.strictObject({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  type: z.enum(['sales', 'inventory']).default('sales'),
})

export type ReportPeriodInput = z.infer<typeof ReportPeriodSchema>

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
