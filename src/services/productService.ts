import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type { ProductQueryInput } from '../validations/productValidation'

export const productService = {
  async getByShop(shopId: number, filters: ProductQueryInput) {
    const products = await prisma.product.findMany({
      where: {
        shopId,
        isAvailable: true,
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.search ? { name: { contains: filters.search } } : {}),
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
        optionSets: {
          include: {
            optionSet: {
              include: {
                elements: {
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return products.map(p => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      imageUrl: p.imageUrl,
      category: p.category,
      optionSets: p.optionSets.map(pos => ({
        isRequired: pos.isRequired,
        optionSet: {
          id: pos.optionSet.id,
          name: pos.optionSet.name,
          elements: pos.optionSet.elements.map(el => ({
            id: el.id,
            label: el.label,
            priceModifier: Number(el.priceModifier),
            position: el.position,
          })),
        },
      })),
    }))
  },
}
