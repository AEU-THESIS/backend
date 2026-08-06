import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import { ROLES } from '../constants/roles'
import type { CreateShopInput, UpdateShopSettingsInput } from '../validations/shopValidation'

const shopSettingsSelect = {
  id: true,
  name: true,
  slug: true,
  ownerName: true,
  phone: true,
  address: true,
  bakongAccountId: true,
  currencySymbol: true,
  exchangeRate: true,
  receiptFooter: true,
  isOrderManagementEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const

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
    return prisma.shop.findMany({
      where: { id: shopId },
      select: shopSettingsSelect,
    })
  },

  async getSettings(shopId: number, role?: string | null) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: shopSettingsSelect,
    })

    if (!shop) {
      throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    // bakongAccountId is sensitive payment config — expose it to Admins only.
    // (undefined is dropped from the JSON response.)
    if (role !== ROLES.ADMIN) {
      return { ...shop, bakongAccountId: undefined }
    }

    return shop
  },

  async updateSettings(shopId: number, data: UpdateShopSettingsInput) {
    try {
      return await prisma.shop.update({
        where: { id: shopId },
        data,
        select: shopSettingsSelect,
      })
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') {
        throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
      }

      throw error
    }
  },
}
