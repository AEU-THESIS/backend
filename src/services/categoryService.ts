import { Prisma } from '@prisma/client'
import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  GetCategoryQueryInput,
} from '../validations/categoryValidation'

const DEFAULT_CATEGORY_PAGE_SIZE = 6

const categorySelect = {
  id: true,
  name: true,
  isActive: true,
  sortOrder: true,
  _count: { select: { products: true } },
} satisfies Prisma.CategorySelect

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>

/**
 * Adds `cannotDelete` so the client can disable the delete action up front: a
 * category holding products has to keep them somewhere, so it stays.
 */
const mapCategory = (category: CategoryRow) => ({
  ...category,
  cannotDelete: category._count.products > 0,
})

/**
 * True when a delete was rejected because a child row still references the
 * parent: P2003 is the database FK error, P2014 is Prisma's own required-relation
 * check. Both mean "still in use", not "server broke".
 */
const isRequiredRelationViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2003' || error.code === 'P2014')

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
        type: data.type,
      },
      select: categorySelect,
    })

    return mapCategory(category)
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
        ...(data.type !== undefined && { type: data.type }),
      },
      select: categorySelect,
    })

    return mapCategory(updatedCategory)
  },

  /**
   * Deletes a category. Blocked while it still holds products — those rows point
   * at it via a required FK, so they would be orphaned.
   */
  async remove(shopId: number, categoryId: number) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const existingCategory = await prisma.category.findFirst({
      where: { id: categoryId, shopId },
    })

    if (!existingCategory) {
      throw new AppError(Messages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const productCount = await prisma.product.count({ where: { categoryId } })
    if (productCount > 0) {
      throw new AppError(Messages.CATEGORY_IN_USE, HttpStatus.CONFLICT)
    }

    // promotion_category rows cascade on delete, so no manual cleanup needed.
    try {
      await prisma.category.delete({ where: { id: categoryId } })
    } catch (error) {
      // A product can land in this category between the count above and this
      // delete. The FK then rejects the delete, so report the same conflict the
      // pre-check would have rather than letting it surface as a 500.
      if (isRequiredRelationViolation(error)) {
        throw new AppError(Messages.CATEGORY_IN_USE, HttpStatus.CONFLICT)
      }
      throw error
    }

    return { id: categoryId }
  },

  async getByShop(shopId: number, filters: GetCategoryQueryInput = {}) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const where = {
      shopId,
      ...(filters.search ? { name: { contains: filters.search } } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    }

    if (filters.page === undefined) {
      const categories = await prisma.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        select: categorySelect,
      })

      return categories.map(mapCategory)
    }

    const page = filters.page
    const pageSize = DEFAULT_CATEGORY_PAGE_SIZE

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: categorySelect,
      }),
      prisma.category.count({ where }),
    ])

    return {
      categories: categories.map(mapCategory),
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    }
  },
}
