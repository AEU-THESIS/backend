import { z } from 'zod'

export const ReportPeriodSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
})

export type ReportPeriodInput = z.infer<typeof ReportPeriodSchema>
