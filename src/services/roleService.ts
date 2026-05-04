import { prisma } from '../core/Service'

export const roleService = {
  async getRolesByShop(shopId: number) {
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
