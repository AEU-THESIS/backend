import { z } from 'zod'

export const ProductQuerySchema = z
  .object({
    categoryId: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .transform(val => (val !== undefined ? Number(val) : undefined))
      .pipe(z.number().int().positive().optional()),
    search: z.string().optional(),
  })
  .strict()

export type ProductQueryInput = z.infer<typeof ProductQuerySchema>
