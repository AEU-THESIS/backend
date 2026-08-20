import { z } from 'zod'

/**
 * Validation for the public (Telegram Mini App) ordering routes. The server owns
 * all pricing and the customer identity comes from the verified initData
 * (`req.telegramUser`), never the body — so this schema only covers the menu
 * selections and the delivery contact info the café wants to collect.
 */

// Only the ids are needed; the server re-derives group/option names and prices
// from the DB (never trusts client-sent prices). Strict so unexpected fields are
// rejected.
const PreOrderSelectedOptionSchema = z.strictObject({
  optionSetId: z.number().int().positive(),
  elementId: z.number().int().positive(),
})

const PreOrderItemSchema = z.strictObject({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
  selectedOptions: z.array(PreOrderSelectedOptionSchema).max(20).default([]),
})

// Lenient phone format — collected as information for the cashier to call, NOT
// verified. Accepts +, digits, spaces and dashes; 6–20 chars.
const PHONE_REGEX = /^[+]?[0-9][0-9\s-]{5,19}$/

export const CreatePreOrderSchema = z.strictObject({
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().regex(PHONE_REGEX, 'A valid phone number is required'),
  // Optional free-text address / landmark note (fallback when no GPS shared).
  deliveryAddress: z.string().trim().max(500).optional(),
  // GPS coordinates the guest chose to share (delivery).
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
  items: z.array(PreOrderItemSchema).min(1, 'Order must have at least one item').max(50),
})

export type CreatePreOrderInput = z.infer<typeof CreatePreOrderSchema>

export const ShopSlugParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, 'Invalid shop identifier'),
})

export type ShopSlugParamsInput = z.infer<typeof ShopSlugParamsSchema>
