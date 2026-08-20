import { z } from 'zod'

/**
 * Validation for the Admin/Manager block-list endpoints. `blockedUntil` omitted or
 * null means "block forever"; otherwise a date/time string (parsed in the
 * controller). The Telegram identity comes from the pre-order the staff is viewing.
 */
export const BlockCustomerSchema = z.object({
  telegramUserId: z.string().trim().min(1).max(64),
  telegramUsername: z.string().trim().max(64).optional().nullable(),
  blockedUntil: z.string().trim().min(1).optional().nullable(),
  reason: z.string().trim().max(255).optional().nullable(),
})

export type BlockCustomerInput = z.infer<typeof BlockCustomerSchema>

export const TelegramUserIdParamSchema = z.object({
  telegramUserId: z.string().trim().min(1).max(64),
})
