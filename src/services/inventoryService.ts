import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type {
  AdjustInventoryItemInput,
  CreateInventoryItemInput,
  InventoryHistoryQueryInput,
  InventoryQueryInput,
  UpdateInventoryItemInput,
} from '../validations/inventoryValidation'
import { calculateWeightedAverageCost } from './inventoryCost'

const DEFAULT_COST_CURRENCY = '$'

const getInventoryStatus = (quantity: number, threshold: number) => {
  if (quantity <= 0) return 'out_of_stock'
  if (quantity < threshold) return 'low_stock'
  return 'in_stock'
}

const toNumber = (value: unknown) => Number(value)
// Money values are rounded to 2 dp; unit cost keeps 4 dp so repeated weighted
// averages don't accumulate rounding drift.
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const round4 = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000

const mapInventoryItem = (item: {
  id: number
  shopId: number
  name: string
  unitOfMeasure: string
  currentStock: unknown
  lowStockThreshold: unknown
  unitCost: unknown
  lastUnitCost: unknown
  costCurrency: string
  imageUrl: string | null
  updatedAt: Date
}) => {
  const quantity = toNumber(item.currentStock)
  const minAlertThreshold = toNumber(item.lowStockThreshold)
  const unitCost = toNumber(item.unitCost)

  return {
    id: item.id,
    shopId: item.shopId,
    name: item.name,
    unitOfMeasure: item.unitOfMeasure,
    quantity,
    minAlertThreshold,
    unitCost,
    lastUnitCost: toNumber(item.lastUnitCost),
    costCurrency: item.costCurrency,
    totalValue: round2(quantity * unitCost),
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

const getUnitCost = (data: CreateInventoryItemInput | UpdateInventoryItemInput) => {
  if ('unitCost' in data && data.unitCost !== undefined) return data.unitCost
  if ('unit_cost' in data && data.unit_cost !== undefined) return data.unit_cost
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
    const initialCost = getUnitCost(data) ?? 0
    // Record the item's cost in whatever currency the shop is configured with.
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { currencySymbol: true },
    })

    const item = await prisma.ingredient.create({
      data: {
        shopId,
        name: data.name,
        unitOfMeasure: getUnitOfMeasure(data) || 'unit',
        currentStock: data.quantity,
        lowStockThreshold: getMinAlertThreshold(data) ?? 0,
        unitCost: initialCost,
        lastUnitCost: initialCost,
        costCurrency: shop?.currencySymbol || DEFAULT_COST_CURRENCY,
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
        ...(getUnitCost(data) !== undefined && {
          unitCost: getUnitCost(data),
          lastUnitCost: getUnitCost(data),
        }),
        ...(imageUrl !== undefined && { imageUrl }),
      },
    })

    return mapInventoryItem(item)
  },

  async delete(id: number, shopId: number) {
    await getExistingInventoryItem(id, shopId)

    // Remove the item's adjustment history first: IngredientLog has a required FK
    // to Ingredient with no cascade, so deleting an item that has any stock-in/out
    // history would otherwise fail on the constraint.
    await prisma.$transaction([
      prisma.ingredientLog.deleteMany({ where: { ingredientId: id } }),
      prisma.ingredient.delete({ where: { id } }),
    ])
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
      const oldStock = toNumber(item.currentStock)
      const oldCost = toNumber(item.unitCost)
      // The cost recorded on the history row: for a stock-in it's the purchase
      // price (defaulting to the current cost when omitted); for a removal it's the
      // average cost consumed, so past spend/consumption can be reconstructed.
      let historyUnitCost: number

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

        historyUnitCost = oldCost
      } else {
        // A stock-in requires a price; when the caller omits it we default to the
        // item's current cost, which leaves the weighted average unchanged.
        const purchaseCost = data.unit_cost ?? oldCost
        const weightedCost = round4(
          calculateWeightedAverageCost(oldStock, oldCost, changeAmount, purchaseCost)
        )

        await tx.ingredient.update({
          where: { id },
          data: {
            currentStock: { increment: changeAmount },
            unitCost: weightedCost,
            lastUnitCost: purchaseCost,
          },
        })

        historyUnitCost = purchaseCost
      }

      await tx.ingredientLog.create({
        data: {
          ingredientId: id,
          userId,
          transactionType: data.adjustment_type,
          quantityChanged: changeAmount,
          unitCost: historyUnitCost,
          reason: data.notes || null,
        },
      })

      const updatedItem = await tx.ingredient.findUniqueOrThrow({
        where: { id },
      })

      return mapInventoryItem(updatedItem)
    })
  },

  // Shop-wide valuation of the whole inventory, independent of any list filters,
  // so the total reflects every item the shop holds.
  async getValuation(shopId: number) {
    const items = await prisma.ingredient.findMany({
      where: { shopId },
      select: { currentStock: true, unitCost: true },
    })

    const totalValue = items.reduce(
      (sum, item) => sum + toNumber(item.currentStock) * toNumber(item.unitCost),
      0
    )

    return {
      totalItems: items.length,
      totalValue: round2(totalValue),
    }
  },

  // Stock-adjustment history for a single item, filtered by date range and
  // paginated on the server. Returns the page of rows, pagination metadata, and
  // the total in/out across the *whole* filtered range (not just the page) so the
  // summary figures stay correct regardless of which page is shown.
  async getHistory(id: number, shopId: number, query: InventoryHistoryQueryInput) {
    await getExistingInventoryItem(id, shopId)

    const { page, limit } = query
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (query.from) dateFilter.gte = new Date(query.from)
    if (query.to) dateFilter.lte = new Date(query.to)
    const where = {
      ingredientId: id,
      ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
    }

    const [total, addsSum, removesSum, logs] = await Promise.all([
      prisma.ingredientLog.count({ where }),
      prisma.ingredientLog.aggregate({
        where: { ...where, transactionType: 'add' },
        _sum: { quantityChanged: true },
      }),
      prisma.ingredientLog.aggregate({
        where: { ...where, transactionType: 'remove' },
        _sum: { quantityChanged: true },
      }),
      prisma.ingredientLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              // Same deterministic ordering used elsewhere, so the role is stable.
              roles: { orderBy: { roleId: 'asc' }, include: { role: true } },
            },
          },
        },
      }),
    ])

    return {
      items: logs.map(log => ({
        id: log.id,
        type: log.transactionType,
        quantityChanged: toNumber(log.quantityChanged),
        unitCost: log.unitCost === null ? null : toNumber(log.unitCost),
        notes: log.reason,
        user: log.user?.name ?? null,
        userRole: log.user?.roles[0]?.role.name ?? null,
        createdAt: log.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      totals: {
        totalIn: toNumber(addsSum._sum.quantityChanged ?? 0),
        totalOut: toNumber(removesSum._sum.quantityChanged ?? 0),
      },
    }
  },
}
