import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
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
  createdAt: true,
  updatedAt: true,
} as const

export const shopService = {
  async create(data: CreateShopInput) {
    const existing = await prisma.shop.findFirst({
      where: { slug: data.slug },
    })

    if (existing) {
      throw new AppError('Shop slug already exists', HttpStatus.BAD_REQUEST)
    }

    const shop = await prisma.shop.create({
      data,
    })

    return shop
  },

  async getAll() {
    return prisma.shop.findMany()
  },

  async getSettings(shopId: number) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: shopSettingsSelect,
    })

    if (!shop) {
      throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    return shop
  },

  async updateSettings(shopId: number, data: UpdateShopSettingsInput) {
    const existing = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    })

    if (!existing) {
      throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    return prisma.shop.update({
      where: { id: shopId },
      data,
      select: shopSettingsSelect,
    })
  },
}
