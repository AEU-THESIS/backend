import { z } from 'zod'

const SelectedOptionSchema = z.strictObject({
  optionSetId: z.number().int().positive(),
  elementId: z.number().int().positive(),
  groupName: z.string().min(1),
  optionName: z.string().min(1),
  extraPrice: z.number().min(0),
})

const OrderItemSchema = z.strictObject({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
  selectedOptions: z.array(SelectedOptionSchema).default([]),
})

export const CreateOrderSchema = z
  .strictObject({
    orderType: z.enum(['dine_in', 'takeaway']),
    paymentMethod: z.literal('cash'),
    paymentCurrency: z.enum(['USD', 'KHR']),
    // Amount handed over, in the chosen payment currency. Allowed to be 0 so a
    // 100%-off order can be completed. The server owns the total and the exchange
    // rate — neither `totalAmount` nor `exchangeRateSnapshot` is accepted from the
    // client (a strict schema rejects them outright so a forged rate can't apply).
    receivedAmount: z.number().min(0, 'Received amount must be zero or more'),
    items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
  })
  // Riel is only tendered in whole 100៛ notes, so a KHR payment must be a whole
  // number divisible by 100 — this keeps the change payable (no stray 50៛).
  .superRefine((data, ctx) => {
    if (
      data.paymentCurrency === 'KHR' &&
      (!Number.isInteger(data.receivedAmount) || data.receivedAmount % 100 !== 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['receivedAmount'],
        message: 'KHR amount must be a whole number of 100៛ notes',
      })
    }
  })

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

// payment_status / fulfillment_status are DB enums now, so an unknown value in the
// filter would throw a Prisma validation error (500). Validate them here → clean 400.
const FULFILLMENT_STATUSES = ['preparing', 'ready', 'completed', 'canceled'] as const
const PAYMENT_STATUSES = ['paid', 'unpaid', 'refunded', 'partially_refunded'] as const

export const GetOrdersQuerySchema = z.object({
  status: z.enum(FULFILLMENT_STATUSES).optional(),
  // One value, or a comma-separated subset (e.g. "paid,partially_refunded"); every
  // token must be a known payment status.
  paymentStatus: z
    .string()
    .optional()
    .refine(
      value =>
        value === undefined ||
        value
          .split(',')
          .map(s => s.trim())
          .every(s => (PAYMENT_STATUSES as readonly string[]).includes(s)),
      { message: 'Invalid payment status filter' }
    ),
  paymentMethod: z.enum(['cash', 'khqr']).optional(),
  date: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
})

export type GetOrdersQueryInput = z.infer<typeof GetOrdersQuerySchema>

export const GetOrderParamsSchema = z.object({
  id: z.coerce.number().int().positive('Invalid order ID'),
})

export type GetOrderParamsInput = z.infer<typeof GetOrderParamsSchema>

export const UpdateOrderStatusSchema = z.object({
  id: z.coerce.number().int().positive('Invalid order ID'),
  status: z.string().min(1, 'Status is required'),
})

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>

// Whole-order void: an optional free-text reason the manager can record.
export const VoidOrderSchema = z.object({
  reason: z.string().trim().max(255).optional(),
})

export type VoidOrderInput = z.infer<typeof VoidOrderSchema>

// Route params for cancelling a single line item on an order.
export const CancelOrderItemParamsSchema = z.object({
  id: z.coerce.number().int().positive('Invalid order ID'),
  itemId: z.coerce.number().int().positive('Invalid item ID'),
})

export type CancelOrderItemParamsInput = z.infer<typeof CancelOrderItemParamsSchema>
