import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type {
  AdjustInventoryItemInput,
  CreateInventoryItemInput,
  InventoryQueryInput,
  UpdateInventoryItemInput,
} from '../validations/inventoryValidation'

const getInventoryStatus = (quantity: number, threshold: number) => {
  if (quantity <= 0) return 'out_of_stock'
  if (quantity < threshold) return 'low_stock'
  return 'in_stock'
}

const toNumber = (value: unknown) => Number(value)

const mapInventoryItem = (item: {
  id: number
  shopId: number
  name: string
  unitOfMeasure: string
  currentStock: unknown
  lowStockThreshold: unknown
  imageUrl: string | null
  updatedAt: Date
}) => {
  const quantity = toNumber(item.currentStock)
  const minAlertThreshold = toNumber(item.lowStockThreshold)

  return {
    id: item.id,
    shopId: item.shopId,
    name: item.name,
    unitOfMeasure: item.unitOfMeasure,
    quantity,
    minAlertThreshold,
    imageUrl: item.imageUrl,
    status: getInventoryStatus(quantity, minAlertThreshold),
    updatedAt: item.updatedAt,
  }
}

const getUnitOfMeasure = (data: CreateInventoryItemInput | UpdateInventoryItemInput) => {
  if ('unitOfMeasure' in data && data.unitOfMeasure !== undefined) return data.unitOfMeasure
  if ('unit_of_measure' in data && data.unit_of_measure !== undefined) return data.unit_of_measure
  return undefined
}

const getMinAlertThreshold = (data: CreateInventoryItemInput | UpdateInventoryItemInput) => {
  if ('minAlertThreshold' in data && data.minAlertThreshold !== undefined) {
    return data.minAlertThreshold
  }
  if ('min_alert_threshold' in data && data.min_alert_threshold !== undefined) {
    return data.min_alert_threshold
  }
  return undefined
}

const getExistingInventoryItem = async (id: number, shopId: number) => {
  const item = await prisma.ingredient.findFirst({
    where: { id, shopId },
  })

  if (!item) {
    throw new AppError(Messages.NOT_FOUND, HttpStatus.NOT_FOUND)
  }

  return item
}

export const inventoryService = {
  async getAll(shopId: number, query: InventoryQueryInput = {}) {
    const search = query.search?.trim()
    const unit = query.unit?.trim()
    const items = await prisma.ingredient.findMany({
      where: {
        shopId,
        ...(unit && { unitOfMeasure: unit }),
        ...(search && {
          OR: [{ name: { contains: search } }, { unitOfMeasure: { contains: search } }],
        }),
      },
      orderBy: { updatedAt: 'desc' },
    })

    const mappedItems = items.map(mapInventoryItem)
    if (!query.status) return mappedItems

    return mappedItems.filter(item => item.status === query.status)
  },

  async create(shopId: number, data: CreateInventoryItemInput, imageUrl?: string) {
    const item = await prisma.ingredient.create({
      data: {
        shopId,
        name: data.name,
        unitOfMeasure: getUnitOfMeasure(data) || 'unit',
        currentStock: data.quantity,
        lowStockThreshold: getMinAlertThreshold(data) ?? 0,
        imageUrl,
      },
    })

    return mapInventoryItem(item)
  },

  async update(id: number, shopId: number, data: UpdateInventoryItemInput, imageUrl?: string) {
    await getExistingInventoryItem(id, shopId)

    const item = await prisma.ingredient.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(getUnitOfMeasure(data) !== undefined && { unitOfMeasure: getUnitOfMeasure(data) }),
        ...(data.quantity !== undefined && { currentStock: data.quantity }),
        ...(getMinAlertThreshold(data) !== undefined && {
          lowStockThreshold: getMinAlertThreshold(data),
        }),
        ...(imageUrl !== undefined && { imageUrl }),
      },
    })

    return mapInventoryItem(item)
  },

  async delete(id: number, shopId: number) {
    await getExistingInventoryItem(id, shopId)

    await prisma.ingredient.delete({
      where: { id },
    })
  },

  async adjust(id: number, shopId: number, userId: number, data: AdjustInventoryItemInput) {
    return prisma.$transaction(async tx => {
      const item = await tx.ingredient.findFirst({
        where: { id, shopId },
      })

      if (!item) {
        throw new AppError(Messages.NOT_FOUND, HttpStatus.NOT_FOUND)
      }

      const changeAmount = data.change_amount

      if (data.adjustment_type === 'remove') {
        const result = await tx.ingredient.updateMany({
          where: {
            id,
            shopId,
            currentStock: { gte: changeAmount },
          },
          data: {
            currentStock: { decrement: changeAmount },
          },
        })

        if (result.count !== 1) {
          throw new AppError(Messages.INSUFFICIENT_STOCK, HttpStatus.BAD_REQUEST)
        }
      } else {
        await tx.ingredient.update({
          where: { id },
          data: {
            currentStock: { increment: changeAmount },
          },
        })
      }

      await tx.ingredientLog.create({
        data: {
          ingredientId: id,
          userId,
          transactionType: data.adjustment_type,
          quantityChanged: changeAmount,
          reason: data.notes || null,
        },
      })

      const updatedItem = await tx.ingredient.findUniqueOrThrow({
        where: { id },
      })

      return mapInventoryItem(updatedItem)
    })
  },
}
