import { z } from 'zod'

// Supported campaign types (see Promotion.discountType).
export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'BOGO'] as const
export const PROMOTION_SCOPES = ['ALL', 'SPECIFIC'] as const

// Accepts an ISO date string (or null) and coerces to a Date.
const optionalDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform(value => new Date(value))
  .optional()
  .nullable()

const scopeIdArray = z.array(z.number().int().positive()).optional().default([])

export const createPromotionSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(191),
    code: z.string().max(191).optional().nullable(),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.number().nonnegative('Value cannot be negative').default(0),
    scope: z.enum(PROMOTION_SCOPES).default('ALL'),
    isActive: z.boolean().default(false),
    startDate: optionalDate,
    endDate: optionalDate,
    categoryIds: scopeIdArray,
    productIds: scopeIdArray,
  })
  .superRefine((data, ctx) => {
    // Percentage discounts are capped at 100%.
    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100',
      })
    }
    // A specific-scope promotion must target at least one category or product.
    if (
      data.scope === 'SPECIFIC' &&
      data.categoryIds.length === 0 &&
      data.productIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scope'],
        message: 'Select at least one category or product for a specific-scope promotion',
      })
    }
    // Date range must be ordered when both are present.
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be after the start date',
      })
    }
  })

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>

// Update allows partial payloads (e.g. a status-only toggle from the dashboard).
export const updatePromotionSchema = z
  .object({
    name: z.string().min(1).max(191).optional(),
    code: z.string().max(191).optional().nullable(),
    discountType: z.enum(DISCOUNT_TYPES).optional(),
    discountValue: z.number().nonnegative().optional(),
    scope: z.enum(PROMOTION_SCOPES).optional(),
    isActive: z.boolean().optional(),
    startDate: optionalDate,
    endDate: optionalDate,
    categoryIds: z.array(z.number().int().positive()).optional(),
    productIds: z.array(z.number().int().positive()).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.discountType === 'PERCENTAGE' &&
      data.discountValue !== undefined &&
      data.discountValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100',
      })
    }
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be after the start date',
      })
    }
  })

export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>

export const getPromotionsQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number).pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform(Number)
    .pipe(z.number().int().positive().max(100)),
  search: z.string().optional(),
})

export type GetPromotionsQueryInput = z.infer<typeof getPromotionsQuerySchema>
