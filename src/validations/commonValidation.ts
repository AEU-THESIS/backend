import { z } from 'zod'

export const idParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'ID must be a numeric string')
    .transform(Number)
    .refine(n => Number.isSafeInteger(n) && n > 0, 'ID must be a positive integer'),
})

export type IdParamInput = z.infer<typeof idParamSchema>
