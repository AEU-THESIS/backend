import { z } from 'zod'

const SelectedOptionSchema = z.object({
  optionSetId: z.number().int().positive(),
  elementId: z.number().int().positive(),
  groupName: z.string().min(1),
  optionName: z.string().min(1),
  extraPrice: z.number().min(0),
})

const OrderItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
  selectedOptions: z.array(SelectedOptionSchema).default([]),
})

export const CreateOrderSchema = z.object({
  orderType: z.enum(['dine_in', 'takeaway']),
  paymentMethod: z.literal('cash'),
  paymentCurrency: z.enum(['USD', 'KHR']),
  receivedAmount: z.number().positive('Received amount must be a positive number'),
  exchangeRateSnapshot: z.number().positive('Exchange rate must be positive'),
  totalAmount: z.number().positive('Total amount must be positive'),
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
})

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
