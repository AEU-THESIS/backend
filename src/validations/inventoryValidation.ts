import { z } from 'zod'

const decimalInput = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(value => Number(value))
  .refine(value => Number.isFinite(value), 'Quantity must be a valid number')

const nonNegativeDecimal = decimalInput.refine(value => value >= 0, 'Quantity cannot be negative')
const positiveDecimal = decimalInput.refine(value => value > 0, 'Quantity must be greater than 0')

const inventoryItemBaseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  unitOfMeasure: z.string().trim().min(1, 'Unit of measure is required').optional(),
  unit_of_measure: z.string().trim().min(1, 'Unit of measure is required').optional(),
  quantity: nonNegativeDecimal.default(0),
  minAlertThreshold: nonNegativeDecimal.optional(),
  min_alert_threshold: nonNegativeDecimal.optional(),
})

type InventoryItemAliasInput = Partial<z.infer<typeof inventoryItemBaseSchema>>

const validateAliasPairs = (data: InventoryItemAliasInput, ctx: z.RefinementCtx) => {
  if (
    data.unitOfMeasure !== undefined &&
    data.unit_of_measure !== undefined &&
    data.unitOfMeasure !== data.unit_of_measure
  ) {
    ;(['unitOfMeasure', 'unit_of_measure'] as const).forEach(path => {
      ctx.addIssue({
        code: 'custom',
        path: [path],
        message: 'unitOfMeasure and unit_of_measure must match when both are provided',
      })
    })
  }

  if (
    data.minAlertThreshold !== undefined &&
    data.min_alert_threshold !== undefined &&
    data.minAlertThreshold !== data.min_alert_threshold
  ) {
    ;(['minAlertThreshold', 'min_alert_threshold'] as const).forEach(path => {
      ctx.addIssue({
        code: 'custom',
        path: [path],
        message: 'minAlertThreshold and min_alert_threshold must match when both are provided',
      })
    })
  }
}

export const createInventoryItemSchema = inventoryItemBaseSchema.superRefine(validateAliasPairs)

export const updateInventoryItemSchema = inventoryItemBaseSchema
  .partial()
  .superRefine(validateAliasPairs)
  .refine(data => Object.keys(data).length > 0, 'At least one inventory field is required')

export const adjustInventoryItemSchema = z.object({
  adjustment_type: z.enum(['add', 'remove']),
  change_amount: positiveDecimal,
  notes: z.string().trim().optional().nullable(),
})

export const inventoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
  unit: z.string().trim().optional(),
})

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>
export type AdjustInventoryItemInput = z.infer<typeof adjustInventoryItemSchema>
export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>
