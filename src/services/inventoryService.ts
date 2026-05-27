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
  sku: string | null
  unitOfMeasure: string
  quantity: unknown
  minAlertThreshold: unknown
  imageUrl: string | null
  createdAt: Date
  updatedAt: Date
}) => {
  const quantity = toNumber(item.quantity)
  const minAlertThreshold = toNumber(item.minAlertThreshold)

  return {
    id: item.id,
    shopId: item.shopId,
    name: item.name,
    sku: item.sku,
    unitOfMeasure: item.unitOfMeasure,
    quantity,
    minAlertThreshold,
    imageUrl: item.imageUrl,
    status: getInventoryStatus(quantity, minAlertThreshold),
    createdAt: item.createdAt,
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
  const item = await prisma.inventoryItem.findFirst({
    where: { id, shopId, isDeleted: false },
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
    const items = await prisma.inventoryItem.findMany({
      where: {
        shopId,
        isDeleted: false,
        ...(unit && { unitOfMeasure: unit }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { unitOfMeasure: { contains: search } },
          ],
        }),
      },
      orderBy: { updatedAt: 'desc' },
    })

    const mappedItems = items.map(mapInventoryItem)
    if (!query.status) return mappedItems

    return mappedItems.filter(item => item.status === query.status)
  },

  async create(shopId: number, data: CreateInventoryItemInput, imageUrl?: string) {
    const item = await prisma.inventoryItem.create({
      data: {
        shopId,
        name: data.name,
        sku: data.sku || null,
        unitOfMeasure: getUnitOfMeasure(data) || 'unit',
        quantity: data.quantity,
        minAlertThreshold: getMinAlertThreshold(data) ?? 0,
        imageUrl,
      },
    })

    return mapInventoryItem(item)
  },

  async update(id: number, shopId: number, data: UpdateInventoryItemInput, imageUrl?: string) {
    await getExistingInventoryItem(id, shopId)

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sku !== undefined && { sku: data.sku || null }),
        ...(getUnitOfMeasure(data) !== undefined && { unitOfMeasure: getUnitOfMeasure(data) }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(getMinAlertThreshold(data) !== undefined && {
          minAlertThreshold: getMinAlertThreshold(data),
        }),
        ...(imageUrl !== undefined && { imageUrl }),
      },
    })

    return mapInventoryItem(item)
  },

  async delete(id: number, shopId: number) {
    await getExistingInventoryItem(id, shopId)

    await prisma.inventoryItem.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    })
  },

  async adjust(id: number, shopId: number, userId: number, data: AdjustInventoryItemInput) {
    return prisma.$transaction(async tx => {
      const item = await tx.inventoryItem.findFirst({
        where: { id, shopId, isDeleted: false },
      })

      if (!item) {
        throw new AppError(Messages.NOT_FOUND, HttpStatus.NOT_FOUND)
      }

      const changeAmount = data.change_amount

      if (data.adjustment_type === 'remove') {
        const result = await tx.inventoryItem.updateMany({
          where: {
            id,
            shopId,
            isDeleted: false,
            quantity: { gte: changeAmount },
          },
          data: {
            quantity: { decrement: changeAmount },
          },
        })

        if (result.count !== 1) {
          throw new AppError(Messages.INSUFFICIENT_STOCK, HttpStatus.BAD_REQUEST)
        }
      } else {
        await tx.inventoryItem.update({
          where: { id },
          data: {
            quantity: { increment: changeAmount },
          },
        })
      }

      await tx.inventoryLog.create({
        data: {
          inventoryItemId: id,
          userId,
          adjustmentType: data.adjustment_type,
          quantityChanged: changeAmount,
          notes: data.notes || null,
        },
      })

      const updatedItem = await tx.inventoryItem.findUniqueOrThrow({
        where: { id },
      })

      return mapInventoryItem(updatedItem)
    })
  },
}
