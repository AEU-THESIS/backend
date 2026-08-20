import { PriceMode } from '@prisma/client'
import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type {
  ProductQueryInput,
  CreateProductInput,
  UpdateProductInput,
} from '../validations/productValidation'

export const productService = {
  async create(shopId: number, data: CreateProductInput) {
    // Verify category exists and belongs to shop
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    })

    if (!category) {
      throw new AppError(Messages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (category.shopId !== shopId) {
      throw new AppError(Messages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND)
    }
    return prisma.$transaction(async tx => {
      const product = await tx.product.create({
        data: {
          shopId,
          categoryId: data.categoryId,
          name: data.name,
          price: data.price || null,
          imageUrl: data.imageUrl || null,
          isAvailable: data.isAvailable,
          priceMode: data.priceMode || 'fixed',
          type: data.type || 'drink',
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
      })

      // Create option sets if provided
      if (data.optionSets && data.optionSets.length > 0) {
        for (const osData of data.optionSets) {
          // Create new option set
          const newOptionSet = await tx.optionSet.create({
            data: {
              shopId,
              name: osData.name,
              type: osData.type,
            },
          })

          // Create option set elements if provided
          if (osData.elements && osData.elements.length > 0) {
            await tx.optionSetElement.createMany({
              data: osData.elements.map((el, index) => ({
                optionSetId: newOptionSet.id,
                label: el.label,
                priceModifier: el.priceModifier || 0,
                position: el.position !== undefined ? el.position : index,
              })),
            })
          }

          // Associate the newly created option set with the product
          await tx.productOptionSet.create({
            data: {
              productId: product.id,
              optionSetId: newOptionSet.id,
              isRequired: osData.isRequired,
            },
          })
        }

        // Fetch updated product with option sets
        const productWithOptionSets = await tx.product.findUniqueOrThrow({
          where: { id: product.id },
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
        })

        return this.mapProducts([productWithOptionSets!])[0]
      }
      return this.mapProducts([product])[0]
    })
  },

  async getByShop(shopId: number, filters: ProductQueryInput) {
    const hasPagination = filters.page !== undefined && filters.pageSize !== undefined
    const skip = hasPagination ? (filters.page! - 1) * filters.pageSize! : undefined
    const take = hasPagination ? filters.pageSize : undefined

    const baseWhere = {
      shopId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.isAvailable !== undefined ? { isAvailable: filters.isAvailable } : {}),
      ...(filters.search ? { name: { contains: filters.search } } : {}),
    }

    if (hasPagination) {
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: baseWhere,
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
          skip,
          take,
        }),
        prisma.product.count({ where: baseWhere }),
      ])

      const mappedProducts = this.mapProducts(products)

      return {
        products: mappedProducts,
        total,
      }
    }

    // No pagination - return all products
    const products = await prisma.product.findMany({
      where: baseWhere,
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

    return {
      products: this.mapProducts(products),
    }
  },

  async getById(productId: number, shopId: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
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
    })

    if (!product) {
      throw new AppError('Product not found', HttpStatus.NOT_FOUND)
    }

    if (product.shopId !== shopId) {
      throw new AppError('Product not found', HttpStatus.NOT_FOUND)
    }

    return this.mapProducts([product])[0]
  },

  async update(productId: number, shopId: number, data: UpdateProductInput) {
    // Verify product exists and belongs to shop
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!existingProduct) {
      throw new AppError('Product not found', HttpStatus.NOT_FOUND)
    }

    if (existingProduct.shopId !== shopId) {
      throw new AppError('Product not found', HttpStatus.NOT_FOUND)
    }

    if (data.categoryId !== undefined) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      })

      if (!category || category.shopId !== shopId) {
        throw new AppError(Messages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND)
      }
    }
    const nextPriceMode = data.priceMode ?? existingProduct.priceMode
    const nextPrice = data.price !== undefined ? data.price : existingProduct.price

    if (nextPriceMode === 'fixed' && nextPrice == null) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    return prisma.$transaction(async tx => {
      // Update product
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
          ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
          ...(data.priceMode !== undefined && { priceMode: data.priceMode }),
          ...(data.type !== undefined && { type: data.type }),
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
      })

      // Update option sets if provided
      if (data.optionSets !== undefined) {
        // Fetch existing option sets for the product
        const existingOptionSets = await tx.productOptionSet.findMany({
          where: { productId },
          select: { optionSetId: true },
        })
        // Extract just the IDs
        const optionSetIds = existingOptionSets.map(item => item.optionSetId)

        await tx.optionSetElement.deleteMany({
          where: { optionSetId: { in: optionSetIds } },
        })
        await tx.optionSet.deleteMany({
          where: { id: { in: optionSetIds } },
        })
        await tx.productOptionSet.deleteMany({
          where: { productId },
        })

        if (data.optionSets && data.optionSets.length > 0) {
          for (const osData of data.optionSets) {
            // Create new option set
            const newOptionSet = await tx.optionSet.create({
              data: {
                shopId,
                name: osData.name,
                type: osData.type,
              },
            })

            // Create option set elements if provided
            if (osData.elements && osData.elements.length > 0) {
              await tx.optionSetElement.createMany({
                data: osData.elements.map((el, index) => ({
                  optionSetId: newOptionSet.id,
                  label: el.label,
                  priceModifier: el.priceModifier || 0,
                  position: el.position !== undefined ? el.position : index,
                })),
              })
            }

            // Associate the newly created option set with the product
            await tx.productOptionSet.create({
              data: {
                productId,
                optionSetId: newOptionSet.id,
                isRequired: osData.isRequired,
              },
            })
          }
        }

        // Fetch updated product with new option sets
        const productWithUpdatedSets = await tx.product.findUniqueOrThrow({
          where: { id: productId },
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
        })

        return this.mapProducts([productWithUpdatedSets!])[0]
      }

      return this.mapProducts([updatedProduct])[0]
    })
  },

  mapProducts(products: any[]) {
    return products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price ? Number(p.price) : null,
      imageUrl: p.imageUrl,
      categoryId: p.category?.id ?? p.categoryId ?? null,
      category: p.category,
      isAvailable: p.isAvailable,
      priceMode: p.priceMode,
      type: p.type,
      optionSets: p.optionSets.map((pos: any) => ({
        isRequired: pos.isRequired,
        optionSet: {
          id: pos.optionSet.id,
          name: pos.optionSet.name,
          type: pos.optionSet.type,
          elements: pos.optionSet.elements.map((el: any) => ({
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
