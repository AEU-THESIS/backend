import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  GetCategoryQueryInput,
} from '../validations/categoryValidation'

const DEFAULT_CATEGORY_PAGE_SIZE = 6

export const categoryService = {
  async create(shopId: number, data: CreateCategoryInput) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const category = await prisma.category.create({
      data: {
        shopId,
        name: data.name,
        isActive: data.isActive,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        sortOrder: true,
      },
    })

    return category
  },

  async update(shopId: number, categoryId: number, data: UpdateCategoryInput) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
    })

    if (!existingCategory || existingCategory.shopId !== shopId) {
      throw new AppError(Messages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
    })

    return updatedCategory
  },

  async getByShop(shopId: number, filters: GetCategoryQueryInput = {}) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const where = {
      shopId,
      ...(filters.search ? { name: { contains: filters.search } } : {}),
    }

    if (filters.page === undefined) {
      const categories = await prisma.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          isActive: true,
          _count: { select: { products: true } },
        },
      })

      return categories
    }

    const page = filters.page
    const pageSize = DEFAULT_CATEGORY_PAGE_SIZE

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          sortOrder: true,
          isActive: true,
          _count: { select: { products: true } },
        },
      }),
      prisma.category.count({ where }),
    ])

    return {
      categories,
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    }
  },
}
