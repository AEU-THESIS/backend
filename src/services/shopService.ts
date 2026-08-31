import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import { ROLES } from '../constants/roles'
import { DEFAULT_PAYMENT_BANKS } from '../constants/paymentBanks'
import type { CreateShopInput, UpdateShopSettingsInput } from '../validations/shopValidation'

const shopSettingsSelect = {
  id: true,
  name: true,
  slug: true,
  ownerName: true,
  phone: true,
  address: true,
  bakongAccountId: true,
  paymentBanks: true,
  currencySymbol: true,
  exchangeRate: true,
  receiptFooter: true,
  isOrderManagementEnabled: true,
  isShopClosed: true,
  createdAt: true,
  updatedAt: true,
} as const

// The `payment_banks` column is JSON and may be null (never configured) or an empty
// array (admin removed them all). The POS bank selector needs at least one option, so
// normalise to a clean list of non-empty strings and fall back to the default (ABA)
// whenever nothing usable is stored.
function normalizePaymentBanks(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
        .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
        .map(b => b.trim())
    : []
  return list.length > 0 ? list : [...DEFAULT_PAYMENT_BANKS]
}

export const shopService = {
  async create(data: CreateShopInput) {
    const existing = await prisma.shop.findFirst({
      where: { slug: data.slug },
    })

    if (existing) {
      throw new AppError(Messages.SHOP_SLUG_EXISTS, HttpStatus.BAD_REQUEST)
    }

    try {
      const shop = await prisma.shop.create({
        data,
      })

      return shop
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new AppError(Messages.SHOP_SLUG_EXISTS, HttpStatus.BAD_REQUEST)
      }

      throw error
    }
  },

  async getByShopId(shopId: number) {
    // Multi-tenant isolation: a caller may only ever see their own shop, never
    // the full table. Kept as a list to preserve the endpoint's response shape.
    const shops = await prisma.shop.findMany({
      where: { id: shopId },
      select: shopSettingsSelect,
    })
    return shops.map(shop => ({ ...shop, paymentBanks: normalizePaymentBanks(shop.paymentBanks) }))
  },

  async getSettings(shopId: number, role?: string | null) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: shopSettingsSelect,
    })

    if (!shop) {
      throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    // Always hand the client a usable bank list (defaulted when unset).
    const normalized = { ...shop, paymentBanks: normalizePaymentBanks(shop.paymentBanks) }

    // bakongAccountId is sensitive payment config — expose it to Admins only.
    // (undefined is dropped from the JSON response.)
    if (role !== ROLES.ADMIN) {
      return { ...normalized, bakongAccountId: undefined }
    }

    return normalized
  },

  async updateSettings(shopId: number, data: UpdateShopSettingsInput) {
    try {
      const shop = await prisma.shop.update({
        where: { id: shopId },
        data,
        select: shopSettingsSelect,
      })
      return { ...shop, paymentBanks: normalizePaymentBanks(shop.paymentBanks) }
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') {
        throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
      }

      throw error
    }
  },
}
