import { z } from 'zod'

export const ProductQuerySchema = z.object({
  categoryId: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  search: z.string().optional(),
})

export type ProductQueryInput = z.infer<typeof ProductQuerySchema>
