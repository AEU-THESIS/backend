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
    isAvailable: z
      .enum(['true', 'false'])
      .transform(val => val === 'true')
      .optional(),
    page: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .transform(val => (val !== undefined ? Number(val) : undefined))
      .pipe(z.number().int().positive().optional()),
    pageSize: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .transform(val => (val !== undefined ? Number(val) : undefined))
      .pipe(z.number().int().positive().max(100).optional()),
  })
  .strict()

export type ProductQueryInput = z.infer<typeof ProductQuerySchema>

export const CreateProductSchema = z
  .object({
    name: z.string().min(1, 'Product name is required').max(255),
    categoryId: z.number().int().positive('Category ID must be positive'),
    price: z.number().positive('Price must be positive').nullable().optional(),
    imageUrl: z.string().optional().nullable(),
    isAvailable: z.boolean().default(true).optional(),
    priceMode: z.enum(['fixed', 'by_size']).default('fixed').optional(),
    type: z.enum(['drink', 'food']).default('drink').optional(),
    optionSets: z
      .array(
        z.object({
          name: z.string().min(1, 'Option set name is required'),
          isRequired: z.boolean().default(false),
          type: z.enum(['size', 'custom']).default('custom'),
          elements: z
            .array(
              z.object({
                label: z.string().min(1, 'Element label is required'),
                priceModifier: z.number().default(0),
                position: z.number().int().default(0),
              })
            )
            .optional(),
        })
      )
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.priceMode !== 'by_size' && data.price == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['price'],
        message: 'Price is required for fixed-price products',
      })
    }
  })

export type CreateProductInput = z.infer<typeof CreateProductSchema>

export const UpdateProductSchema = z
  .object({
    name: z.string().min(1, 'Product name is required').max(255).optional(),
    price: z.number().positive('Price must be positive').nullable().optional(),
    categoryId: z.number().int().positive('Category ID must be positive').optional(),
    imageUrl: z.string().optional().nullable(),
    isAvailable: z.boolean().optional(),
    priceMode: z.enum(['fixed', 'by_size']).optional(),
    type: z.enum(['drink', 'food']).optional(),
    optionSets: z
      .array(
        z
          .object({
            name: z.string().min(1, 'Option set name is required'),
            isRequired: z.boolean().default(false),
            type: z.enum(['size', 'custom']).default('custom'),
            elements: z
              .array(
                z.object({
                  label: z.string().min(1, 'Element label is required'),
                  priceModifier: z.number().default(0),
                  position: z.number().int().default(0),
                })
              )
              .optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict()

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
