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

export const CreateOrderSchema = z.strictObject({
  orderType: z.enum(['dine_in', 'takeaway']),
  paymentMethod: z.literal('cash'),
  paymentCurrency: z.enum(['USD', 'KHR']),
  receivedAmount: z.number().positive('Received amount must be a positive number'),
  exchangeRateSnapshot: z.number().positive('Exchange rate must be positive'),
  totalAmount: z.number().positive('Total amount must be positive'),
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
})

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

export const GetOrdersQuerySchema = z.object({
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
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
