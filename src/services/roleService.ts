import { prisma, AppError, HttpStatus, Messages } from '../core/Service'

export const roleService = {
  async getRolesByShop(shopId: number) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    return prisma.role.findMany({
      where: { shopId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })
  },
}
