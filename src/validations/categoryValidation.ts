import { z } from 'zod'

export const categoryTypeSchema = z.enum(['product', 'inventory'])

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    isActive: z.boolean(),
    type: categoryTypeSchema.default('product'),
  })
  .strict()

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine(
    data => Object.keys(data).length > 0,
    'At least one field is required to update a category'
  )

export const getCategoryQuerySchema = z
  .object({
    search: z.string().trim().optional(),
    type: categoryTypeSchema.optional(),
    page: z
      .string()
      .regex(/^[0-9]+$/)
      .optional()
      .transform(value => (value !== undefined ? Number(value) : undefined))
      .pipe(z.number().int().positive().optional()),
  })
  .strict()

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type GetCategoryQueryInput = z.infer<typeof getCategoryQuerySchema>
