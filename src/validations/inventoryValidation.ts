import { z } from 'zod'

const decimalInput = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(value => Number(value))
  .refine(value => Number.isFinite(value), 'Quantity must be a valid number')

const nonNegativeDecimal = decimalInput.refine(value => value >= 0, 'Quantity cannot be negative')
const positiveDecimal = decimalInput.refine(value => value > 0, 'Quantity must be greater than 0')

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  sku: z.string().trim().optional().nullable(),
  unitOfMeasure: z.string().trim().min(1, 'Unit of measure is required').optional(),
  unit_of_measure: z.string().trim().min(1, 'Unit of measure is required').optional(),
  quantity: nonNegativeDecimal.default(0),
  minAlertThreshold: nonNegativeDecimal.optional(),
  min_alert_threshold: nonNegativeDecimal.optional(),
})

export const updateInventoryItemSchema = createInventoryItemSchema
  .partial()
  .refine(data => Object.keys(data).length > 0, 'At least one inventory field is required')

export const adjustInventoryItemSchema = z.object({
  adjustment_type: z.enum(['add', 'remove']),
  change_amount: positiveDecimal,
  notes: z.string().trim().optional().nullable(),
})

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>
export type AdjustInventoryItemInput = z.infer<typeof adjustInventoryItemSchema>
