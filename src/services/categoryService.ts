import { prisma, AppError, HttpStatus, Messages } from '../core/Service'

export const categoryService = {
  async getByShop(shopId: number) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const categories = await prisma.category.findMany({
      where: { shopId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
    })
    return categories
  },
}
