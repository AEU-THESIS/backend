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

const VariationTemplateOptionSchema = z
  .object({
    optionLabel: z.string().trim().min(1, 'Option label is required').max(255),
    priceModifier: z.number().min(0).default(0),
    displayOrder: z.number().int().min(0).default(0),
  })
  .strict()

export const CreateVariationTemplateSchema = z
  .object({
    name: z.string().trim().min(1, 'Template name is required').max(255),
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

export type VariationTemplateQueryInput = z.infer<typeof VariationTemplateQuerySchema>
export type CreateVariationTemplateInput = z.infer<typeof CreateVariationTemplateSchema>
export type UpdateVariationTemplateInput = z.infer<typeof UpdateVariationTemplateSchema>
