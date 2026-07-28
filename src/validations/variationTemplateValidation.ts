import { z } from 'zod'

export const VariationTemplateCategorySchema = z.enum([
  'Coffee',
  'Drink',
  'Food',
  'Dessert',
  'Other',
])

export const VariationTemplateQuerySchema = z
  .object({
    search: z.string().trim().optional(),
    includeArchived: z
      .enum(['true', 'false'])
      .transform(value => value === 'true')
      .optional(),
  })
  .strict()

export const VariationTemplateDeleteQuerySchema = z
  .object({
    archive: z.enum(['true', 'false']).optional(),
  })
  .strict()

const priceModifierSchema = z
  .number()
  .min(0, 'Price modifier cannot be negative')
  .refine(
    value => Number.isInteger(value) || /^\d+\.\d{1,2}$/.test(value.toString()),
    'Price modifier must have at most 2 decimal places'
  )
  .refine(value => value <= 99999999.99, 'Price modifier is too large')
  .default(0)

const VariationTemplateOptionSchema = z
  .object({
    optionLabel: z.string().trim().min(1, 'Option label is required').max(191),
    priceModifier: priceModifierSchema,
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict()

export const CreateVariationTemplateSchema = z
  .object({
    name: z.string().trim().min(1, 'Template name is required').max(191),
    description: z.string().trim().max(1000).optional().nullable(),
    category: VariationTemplateCategorySchema.default('Other'),
    options: z.array(VariationTemplateOptionSchema).min(1, 'At least one option is required'),
  })
  .strict()

export const UpdateVariationTemplateSchema = CreateVariationTemplateSchema.partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(data => Object.keys(data).length > 0, 'At least one field must be provided to update')

export type VariationTemplateQueryInput = z.infer<typeof VariationTemplateQuerySchema>
export type VariationTemplateDeleteQueryInput = z.infer<typeof VariationTemplateDeleteQuerySchema>
export type CreateVariationTemplateInput = z.infer<typeof CreateVariationTemplateSchema>
export type UpdateVariationTemplateInput = z.infer<typeof UpdateVariationTemplateSchema>
