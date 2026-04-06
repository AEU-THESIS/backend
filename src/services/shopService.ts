import { prisma, AppError, HttpStatus } from "../core/Service";
import type { CreateShopInput } from "../validations/shopValidation";

export const shopService = {
  async create(data: CreateShopInput) {
    const existing = await prisma.shop.findFirst({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new AppError("Shop slug already exists", HttpStatus.BAD_REQUEST);
    }

    const shop = await prisma.shop.create({
      data,
    });

    return shop;
  },

  async getAll() {
    return prisma.shop.findMany();
  },
};
