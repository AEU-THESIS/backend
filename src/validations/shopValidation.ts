import { z } from 'zod'

const optionalText = z.string().trim().nullable().optional()

// Admin-configurable list of banks for manual KHQR payments. Trims, drops blanks, and
// de-duplicates case-insensitively (preserving first-seen order) so the stored list is
// always clean. An empty list is allowed here and coalesced to the default on read.
const bankListSchema = z
  .array(z.string().trim().min(1, 'Bank name is required').max(191, 'Bank name is too long'))
  .max(50, 'Too many banks')
  .transform(list => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const bank of list) {
      const key = bank.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(bank)
    }
    return result
  })

const decimalSchema = z
  .union([
    z
      .number()
      .finite('Exchange rate must be a valid number')
      .refine(
        value => Number.isInteger(value) || /^\d+\.\d{1,2}$/.test(value.toString()),
        'Exchange rate must have at most 2 decimal places'
      ),
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, 'Exchange rate must be a valid decimal'),
  ])
  .transform(value => Number(value))
  .refine(value => value > 0, 'Exchange rate must be greater than 0')
  .refine(value => value <= 99999999.99, 'Exchange rate is too large')

export const createShopSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and dashes only'),
    ownerName: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    currencySymbol: z.string().default('$'),
  })
  .strict()

export const updateShopSettingsSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').optional(),
    ownerName: optionalText,
    owner_name: optionalText,
    phone: optionalText,
    address: optionalText,
    bakongAccountId: optionalText,
    bakong_account_id: optionalText,
    paymentBanks: bankListSchema.optional(),
    payment_banks: bankListSchema.optional(),
    currencySymbol: z.string().trim().min(1).optional(),
    currency_symbol: z.string().trim().min(1).optional(),
    exchangeRate: decimalSchema.optional(),
    exchange_rate: decimalSchema.optional(),
    receiptFooter: optionalText,
    receipt_footer: optionalText,
    isOrderManagementEnabled: z.boolean().optional(),
    is_order_management_enabled: z.boolean().optional(),
    isShopClosed: z.boolean().optional(),
    is_shop_closed: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const aliasPairs = [
      ['ownerName', 'owner_name'],
      ['bakongAccountId', 'bakong_account_id'],
      ['paymentBanks', 'payment_banks'],
      ['currencySymbol', 'currency_symbol'],
      ['exchangeRate', 'exchange_rate'],
      ['receiptFooter', 'receipt_footer'],
      ['isOrderManagementEnabled', 'is_order_management_enabled'],
      ['isShopClosed', 'is_shop_closed'],
    ] as const

    for (const [camelCaseKey, snakeCaseKey] of aliasPairs) {
      if (data[camelCaseKey] !== undefined && data[snakeCaseKey] !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [snakeCaseKey],
          message: `Use either ${camelCaseKey} or ${snakeCaseKey}, not both`,
        })
      }
    }
  })
  .transform(data => ({
    ...(data.name !== undefined && { name: data.name }),
    ...(data.ownerName !== undefined && { ownerName: data.ownerName }),
    ...(data.owner_name !== undefined && { ownerName: data.owner_name }),
    ...(data.phone !== undefined && { phone: data.phone }),
    ...(data.address !== undefined && { address: data.address }),
    ...(data.bakongAccountId !== undefined && {
      bakongAccountId: data.bakongAccountId,
    }),
    ...(data.bakong_account_id !== undefined && {
      bakongAccountId: data.bakong_account_id,
    }),
    ...(data.paymentBanks !== undefined && { paymentBanks: data.paymentBanks }),
    ...(data.payment_banks !== undefined && { paymentBanks: data.payment_banks }),
    ...(data.currencySymbol !== undefined && {
      currencySymbol: data.currencySymbol,
    }),
    ...(data.currency_symbol !== undefined && {
      currencySymbol: data.currency_symbol,
    }),
    ...(data.exchangeRate !== undefined && { exchangeRate: data.exchangeRate }),
    ...(data.exchange_rate !== undefined && {
      exchangeRate: data.exchange_rate,
    }),
    ...(data.receiptFooter !== undefined && {
      receiptFooter: data.receiptFooter,
    }),
    ...(data.receipt_footer !== undefined && {
      receiptFooter: data.receipt_footer,
    }),
    ...(data.isOrderManagementEnabled !== undefined && {
      isOrderManagementEnabled: data.isOrderManagementEnabled,
    }),
    ...(data.is_order_management_enabled !== undefined && {
      isOrderManagementEnabled: data.is_order_management_enabled,
    }),
    ...(data.isShopClosed !== undefined && {
      isShopClosed: data.isShopClosed,
    }),
    ...(data.is_shop_closed !== undefined && {
      isShopClosed: data.is_shop_closed,
    }),
  }))
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one setting field is required',
  })

export type CreateShopInput = z.infer<typeof createShopSchema>
export type UpdateShopSettingsInput = z.infer<typeof updateShopSettingsSchema>
