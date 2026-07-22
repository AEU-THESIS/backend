import { z } from 'zod'

export const ReportPeriodSchema = z.strictObject({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  type: z.enum(['sales', 'inventory']).default('sales'),
})

export type ReportPeriodInput = z.infer<typeof ReportPeriodSchema>

export const DailySummaryQuerySchema = z.strictObject({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(
      val => !isNaN(new Date(`${val}T00:00:00`).getTime()),
      'Date must be a valid calendar date'
    )
    .optional(),
})

export type DailySummaryQueryInput = z.infer<typeof DailySummaryQuerySchema>
