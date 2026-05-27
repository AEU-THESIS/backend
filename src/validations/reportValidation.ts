import { z } from 'zod'

export const ReportPeriodSchema = z.strictObject({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  type: z.enum(['sales', 'inventory']).default('sales'),
})

export type ReportPeriodInput = z.infer<typeof ReportPeriodSchema>
