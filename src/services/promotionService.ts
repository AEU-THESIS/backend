import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type { Prisma } from '@prisma/client'
import type { CreatePromotionInput, UpdatePromotionInput } from '../validations/promotionValidation'

// Fields returned to the client. Scope relations are flattened to id arrays.
const promotionSelect = {
  id: true,
  name: true,
  code: true,
  discountType: true,
  discountValue: true,
  scope: true,
  isActive: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  categories: { select: { categoryId: true } },
  products: { select: { productId: true } },
} satisfies Prisma.PromotionSelect

type PromotionWithScope = Prisma.PromotionGetPayload<{ select: typeof promotionSelect }>

const toDto = (promotion: PromotionWithScope) => ({
  id: promotion.id,
  name: promotion.name,
  code: promotion.code,
  discountType: promotion.discountType,
  discountValue: Number(promotion.discountValue),
  scope: promotion.scope,
  isActive: promotion.isActive,
  startDate: promotion.startDate,
  endDate: promotion.endDate,
  createdAt: promotion.createdAt,
  categoryIds: promotion.categories.map(c => c.categoryId),
  productIds: promotion.products.map(p => p.productId),
})

const assertShop = (shopId: number) => {
  if (!shopId || shopId <= 0) {
    throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
  }
}

/**
 * Ensures every category/product id belongs to the caller's shop before it is
 * written into a scope pivot table. Runs inside the caller's transaction.
 */
const validateScopeOwnership = async (
  tx: Prisma.TransactionClient,
  shopId: number,
  categoryIds: number[],
  productIds: number[]
) => {
  const uniqueCategoryIds = [...new Set(categoryIds)]
  const uniqueProductIds = [...new Set(productIds)]

  if (uniqueCategoryIds.length > 0) {
    const count = await tx.category.count({
      where: { id: { in: uniqueCategoryIds }, shopId },
    })
    if (count !== uniqueCategoryIds.length) {
      throw new AppError(Messages.PROMOTION_INVALID_SCOPE_ITEMS, HttpStatus.BAD_REQUEST)
    }
  }

  if (uniqueProductIds.length > 0) {
    const count = await tx.product.count({
      where: { id: { in: uniqueProductIds }, shopId },
    })
    if (count !== uniqueProductIds.length) {
      throw new AppError(Messages.PROMOTION_INVALID_SCOPE_ITEMS, HttpStatus.BAD_REQUEST)
    }
  }

  return { uniqueCategoryIds, uniqueProductIds }
}

export const promotionService = {
  /**
   * Paginated list of a shop's promotions plus the dashboard summary cards
   * (active promotions, total redeemed, upcoming offers).
   */
  async getByShop(shopId: number, page = 1, limit = 10, search = '') {
    assertShop(shopId)
    const skip = (page - 1) * limit

    const where: Prisma.PromotionWhereInput = { shopId }
    if (search) {
      where.OR = [{ name: { contains: search } }, { code: { contains: search } }]
    }

    const now = new Date()

    const [promotions, total, activePromotions, upcomingOffers, totalRedeemed] = await Promise.all([
      prisma.promotion.findMany({
        where,
        select: promotionSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.promotion.count({ where }),
      prisma.promotion.count({ where: { shopId, isActive: true } }),
      prisma.promotion.count({ where: { shopId, startDate: { gt: now } } }),
      prisma.order.count({ where: { shopId, promotionId: { not: null } } }),
    ])

    return {
      data: promotions.map(toDto),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        activePromotions,
        totalRedeemed,
        upcomingOffers,
      },
    }
  },

  async getById(shopId: number, id: number) {
    assertShop(shopId)
    const promotion = await prisma.promotion.findFirst({
      where: { id, shopId },
      select: promotionSelect,
    })
    if (!promotion) {
      throw new AppError(Messages.PROMOTION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }
    return toDto(promotion)
  },

  /**
   * Creates a promotion and, for a SPECIFIC scope, inserts the nested category
   * and product scope arrays into their pivot tables — all in one transaction.
   */
  async create(shopId: number, input: CreatePromotionInput) {
    assertShop(shopId)

    const categoryIds = input.scope === 'SPECIFIC' ? input.categoryIds : []
    const productIds = input.scope === 'SPECIFIC' ? input.productIds : []

    const promotion = await prisma.$transaction(async tx => {
      const { uniqueCategoryIds, uniqueProductIds } = await validateScopeOwnership(
        tx,
        shopId,
        categoryIds,
        productIds
      )

      const created = await tx.promotion.create({
        data: {
          shopId,
          name: input.name,
          code: input.code ?? null,
          discountType: input.discountType,
          discountValue: input.discountValue,
          scope: input.scope,
          isActive: input.isActive,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
        },
      })

      if (uniqueCategoryIds.length > 0) {
        await tx.promotionCategory.createMany({
          data: uniqueCategoryIds.map(categoryId => ({
            promotionId: created.id,
            categoryId,
          })),
        })
      }

      if (uniqueProductIds.length > 0) {
        await tx.promotionProduct.createMany({
          data: uniqueProductIds.map(productId => ({
            promotionId: created.id,
            productId,
          })),
        })
      }

      return tx.promotion.findUniqueOrThrow({
        where: { id: created.id },
        select: promotionSelect,
      })
    })

    return toDto(promotion)
  },

  /**
   * Updates a promotion. Partial payloads are supported (e.g. a status toggle).
   * When scope arrays are supplied, the pivot rows are fully replaced.
   */
  async update(shopId: number, id: number, input: UpdatePromotionInput) {
    assertShop(shopId)

    const existing = await prisma.promotion.findFirst({ where: { id, shopId } })
    if (!existing) {
      throw new AppError(Messages.PROMOTION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const nextScope = input.scope ?? existing.scope

    // Enforce the same invariants as create() using the effective (merged) values —
    // a partial PUT must not be able to slip past a check by omitting one field.
    const effectiveType = input.discountType ?? existing.discountType
    const effectiveValue = input.discountValue ?? Number(existing.discountValue)
    if (effectiveType === 'PERCENTAGE' && effectiveValue > 100) {
      throw new AppError(Messages.PROMOTION_PERCENTAGE_MAX, HttpStatus.BAD_REQUEST)
    }
    const effectiveStart = input.startDate !== undefined ? input.startDate : existing.startDate
    const effectiveEnd = input.endDate !== undefined ? input.endDate : existing.endDate
    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw new AppError(Messages.PROMOTION_DATE_ORDER, HttpStatus.BAD_REQUEST)
    }

    const promotion = await prisma.$transaction(async tx => {
      await tx.promotion.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code,
          discountType: input.discountType,
          discountValue: input.discountValue,
          scope: input.scope,
          isActive: input.isActive,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      })

      // If the promotion is (or becomes) global, clear any scope rows.
      if (nextScope === 'ALL') {
        await tx.promotionCategory.deleteMany({ where: { promotionId: id } })
        await tx.promotionProduct.deleteMany({ where: { promotionId: id } })
      } else {
        // Replace category scope only when the caller sent the array.
        if (input.categoryIds !== undefined) {
          await validateScopeOwnership(tx, shopId, input.categoryIds, [])
          await tx.promotionCategory.deleteMany({ where: { promotionId: id } })
          if (input.categoryIds.length > 0) {
            await tx.promotionCategory.createMany({
              data: [...new Set(input.categoryIds)].map(categoryId => ({
                promotionId: id,
                categoryId,
              })),
            })
          }
        }
        if (input.productIds !== undefined) {
          await validateScopeOwnership(tx, shopId, [], input.productIds)
          await tx.promotionProduct.deleteMany({ where: { promotionId: id } })
          if (input.productIds.length > 0) {
            await tx.promotionProduct.createMany({
              data: [...new Set(input.productIds)].map(productId => ({
                promotionId: id,
                productId,
              })),
            })
          }
        }

        // A SPECIFIC-scope promotion must still target at least one item after the
        // update (e.g. switching ALL→SPECIFIC without ids, or clearing the arrays).
        const [catCount, prodCount] = await Promise.all([
          tx.promotionCategory.count({ where: { promotionId: id } }),
          tx.promotionProduct.count({ where: { promotionId: id } }),
        ])
        if (catCount + prodCount === 0) {
          throw new AppError(Messages.PROMOTION_SCOPE_REQUIRED, HttpStatus.BAD_REQUEST)
        }
      }

      return tx.promotion.findUniqueOrThrow({
        where: { id },
        select: promotionSelect,
      })
    })

    return toDto(promotion)
  },

  /**
   * Deletes a promotion. Blocked if any order references it (historical data is
   * preserved); scope pivot rows are removed within the same transaction.
   */
  async remove(shopId: number, id: number) {
    assertShop(shopId)

    const existing = await prisma.promotion.findFirst({ where: { id, shopId } })
    if (!existing) {
      throw new AppError(Messages.PROMOTION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const usedByOrders = await prisma.order.count({ where: { promotionId: id } })
    if (usedByOrders > 0) {
      throw new AppError(Messages.PROMOTION_IN_USE, HttpStatus.CONFLICT)
    }

    await prisma.$transaction(async tx => {
      await tx.promotionCategory.deleteMany({ where: { promotionId: id } })
      await tx.promotionProduct.deleteMany({ where: { promotionId: id } })
      await tx.promotion.delete({ where: { id } })
    })
  },
}
