import { z } from 'zod'

// The DB columns are fixed-scale: quantities are DECIMAL(10,2) and costs are
// DECIMAL(12,4). Anything finer is silently rounded on write, so a payload that
// looks accepted would store a different figure than the caller sent. Reject at
// the boundary instead.
const QUANTITY_SCALE = 2
const COST_SCALE = 4

const hasScale = (value: number, scale: number) =>
  Number.isInteger(Number((value * 10 ** scale).toFixed(scale)))

const decimalInput = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(value => Number(value))
  .refine(value => Number.isFinite(value), 'Quantity must be a valid number')

const nonNegativeDecimal = decimalInput
  .refine(value => value >= 0, 'Quantity cannot be negative')
  .refine(
    value => hasScale(value, QUANTITY_SCALE),
    `Quantity supports at most ${QUANTITY_SCALE} decimal places`
  )
const positiveDecimal = decimalInput
  .refine(value => value > 0, 'Quantity must be greater than 0')
  .refine(
    value => hasScale(value, QUANTITY_SCALE),
    `Quantity supports at most ${QUANTITY_SCALE} decimal places`
  )

// Costs get their own scale — a per-unit price like $0.0185/g needs 4 dp.
const nonNegativeCost = decimalInput
  .refine(value => value >= 0, 'Cost cannot be negative')
  .refine(
    value => hasScale(value, COST_SCALE),
    `Cost supports at most ${COST_SCALE} decimal places`
  )

const optionalCategoryId = z.coerce.number().int().positive().optional()

const inventoryItemBaseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  unitOfMeasure: z.string().trim().min(1, 'Unit of measure is required').optional(),
  unit_of_measure: z.string().trim().min(1, 'Unit of measure is required').optional(),
  categoryId: optionalCategoryId,
  category_id: optionalCategoryId,
  // No `.default(0)` here: `.partial()` does not strip a default, so an update
  // that omits `quantity` would still parse to 0 and reset the item's stock.
  // The opening-stock default belongs to create alone (applied below).
  quantity: nonNegativeDecimal.optional(),
  minAlertThreshold: nonNegativeDecimal.optional(),
  min_alert_threshold: nonNegativeDecimal.optional(),
  // Cost price per unit (shop base currency). Optional — the user "can" record it.
  unitCost: nonNegativeCost.optional(),
  unit_cost: nonNegativeCost.optional(),
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

  if (
    data.unitCost !== undefined &&
    data.unit_cost !== undefined &&
    data.unitCost !== data.unit_cost
  ) {
    ;(['unitCost', 'unit_cost'] as const).forEach(path => {
      ctx.addIssue({
        code: 'custom',
        path: [path],
        message: 'unitCost and unit_cost must match when both are provided',
      })
    })
  }

  if (
    data.categoryId !== undefined &&
    data.category_id !== undefined &&
    data.categoryId !== data.category_id
  ) {
    ;(['categoryId', 'category_id'] as const).forEach(path => {
      ctx.addIssue({
        code: 'custom',
        path: [path],
        message: 'categoryId and category_id must match when both are provided',
      })
    })
  }
}

export const createInventoryItemSchema = inventoryItemBaseSchema
  .extend({ quantity: nonNegativeDecimal.default(0) })
  .superRefine(validateAliasPairs)

export const updateInventoryItemSchema = inventoryItemBaseSchema
  .partial()
  .superRefine(validateAliasPairs)
  .refine(data => Object.keys(data).length > 0, 'At least one inventory field is required')

export const adjustInventoryItemSchema = z.object({
  adjustment_type: z.enum(['add', 'remove']),
  change_amount: positiveDecimal,
  // Purchase price per unit for this stock-in (only used when adding stock).
  // Nullish: the client omits it or sends null (e.g. on removals, or to accept the
  // current cost); the service then defaults to the item's existing cost.
  unit_cost: nonNegativeCost.nullish(),
  notes: z.string().trim().optional().nullable(),
})

export const inventoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
  unit: z.string().trim().optional(),
})

// History is filtered by date range and paginated on the server, so the client
// refetches when the period or page changes.
//
// `from`/`to` are documented as ISO 8601 date-times and reach `new Date(...)` in
// the service, so they are validated strictly here: an unparseable string would
// otherwise become an Invalid Date and silently widen the filter, and an
// inverted range would return an empty page that reads as "no activity".
// Swagger documents both as `{ type: string, format: date-time }` — RFC 3339 —
// so a numeric offset is as valid as `Z`, but a date-only value is not. Piped
// rather than chained so the trim happens before the format check.
const isoDateTime = z
  .string()
  .trim()
  .pipe(z.iso.datetime({ offset: true, error: 'Must be an ISO 8601 date-time' }))

// strictObject: an unrecognised query key is a caller mistake (a typo like
// `?form=` would otherwise be dropped in silence and return the unfiltered
// range as though the filter had applied).
export const inventoryHistoryQuerySchema = z
  .strictObject({
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    // Restrict to stock-ins only, removals only, or omit for both.
    type: z.enum(['add', 'remove']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && Date.parse(data.from) > Date.parse(data.to)) {
      ;(['from', 'to'] as const).forEach(path => {
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: 'from must be earlier than or equal to to',
        })
      })
    }
  })

// Expense report is filtered by an explicit date range and grouped either by
// day (for the spend-over-time chart) or by ingredient (for the breakdown
// table). The two groupings are fetched as separate requests rather than one
// combined payload, so each stays a simple, independently-cacheable query.
export const inventoryExpenseReportQuerySchema = z
  .strictObject({
    startDate: isoDateTime,
    endDate: isoDateTime,
    // 'raw' returns individual purchase records (unaggregated) — used to build
    // the Excel export, which needs per-transaction rows rather than totals.
    groupBy: z.enum(['day', 'ingredient', 'raw']).default('day'),
  })
  .superRefine((data, ctx) => {
    if (Date.parse(data.startDate) > Date.parse(data.endDate)) {
      ;(['startDate', 'endDate'] as const).forEach(path => {
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: 'startDate must be earlier than or equal to endDate',
        })
      })
    }
  })

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>
export type AdjustInventoryItemInput = z.infer<typeof adjustInventoryItemSchema>
export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>
export type InventoryHistoryQueryInput = z.infer<typeof inventoryHistoryQuerySchema>
export type InventoryExpenseReportQueryInput = z.infer<typeof inventoryExpenseReportQuerySchema>
