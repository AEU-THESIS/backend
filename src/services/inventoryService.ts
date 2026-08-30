import { Prisma } from '@prisma/client'
import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type {
  AdjustInventoryItemInput,
  CreateInventoryItemInput,
  InventoryHistoryQueryInput,
  InventoryQueryInput,
  UpdateInventoryItemInput,
} from '../validations/inventoryValidation'
import {
  calculateWeightedAverageCost,
  roundCost,
  roundMoney,
  toDecimal,
  type DecimalLike,
} from './inventoryCost'
import { notificationService } from './notificationService'

const DEFAULT_COST_CURRENCY = '$'

const getInventoryStatus = (quantity: Prisma.Decimal, threshold: Prisma.Decimal) => {
  if (quantity.lessThanOrEqualTo(0)) return 'out_of_stock'
  if (quantity.lessThan(threshold)) return 'low_stock'
  return 'in_stock'
}

// Decimal values stay exact through every calculation and are converted to
// `number` only here, at the API boundary.
const serialize = (value: DecimalLike) => toDecimal(value).toNumber()

const mapInventoryItem = (item: {
  id: number
  shopId: number
  name: string
  unitOfMeasure: string
  currentStock: Prisma.Decimal
  lowStockThreshold: Prisma.Decimal
  unitCost: Prisma.Decimal
  lastUnitCost: Prisma.Decimal
  costCurrency: string
  imageUrl: string | null
  updatedAt: Date
  category?: { id: number; name: string } | null
}) => {
  const quantity = toDecimal(item.currentStock)
  const minAlertThreshold = toDecimal(item.lowStockThreshold)
  const unitCost = toDecimal(item.unitCost)

  return {
    id: item.id,
    shopId: item.shopId,
    name: item.name,
    unitOfMeasure: item.unitOfMeasure,
    quantity: quantity.toNumber(),
    minAlertThreshold: minAlertThreshold.toNumber(),
    unitCost: unitCost.toNumber(),
    lastUnitCost: serialize(item.lastUnitCost),
    costCurrency: item.costCurrency,
    totalValue: roundMoney(quantity.times(unitCost)).toNumber(),
    imageUrl: item.imageUrl,
    status: getInventoryStatus(quantity, minAlertThreshold),
    updatedAt: item.updatedAt,
    category: item.category ?? null,
  }
}

// Category is shop-scoped, so an id from another shop must never be attachable
// to this shop's ingredient.
const CATEGORY_SELECT = { select: { id: true, name: true } } as const

const assertCategoryInShop = async (categoryId: number, shopId: number) => {
  const category = await prisma.category.findFirst({ where: { id: categoryId, shopId } })
  if (!category) {
    throw new AppError(Messages.CATEGORY_NOT_FOUND, HttpStatus.BAD_REQUEST)
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

const getCategoryId = (data: CreateInventoryItemInput | UpdateInventoryItemInput) => {
  if ('categoryId' in data && data.categoryId !== undefined) return data.categoryId
  if ('category_id' in data && data.category_id !== undefined) return data.category_id
  return undefined
}

/** Soft-deleted items are invisible to every read path. */
const ACTIVE = { deletedAt: null } as const

const getExistingInventoryItem = async (id: number, shopId: number) => {
  const item = await prisma.ingredient.findFirst({
    where: { id, shopId, ...ACTIVE },
  })

  if (!item) {
    throw new AppError(Messages.NOT_FOUND, HttpStatus.NOT_FOUND)
  }

  return item
}

const checkAndNotifyStockStatus = async (
  shopId: number,
  item: {
    id: number
    name: string
    unitOfMeasure: string
    quantity: number
    minAlertThreshold: number
    status: string
  }
) => {
  try {
    if (item.status === 'out_of_stock') {
      // Resolve any previous low_stock alerts for this item since it has escalated to out of stock
      await prisma.notification.updateMany({
        where: {
          shopId,
          notifiableType: { in: ['ingredient', 'Ingredient'] },
          notifiableId: item.id,
          type: 'low_stock',
          readAt: null,
        },
        data: { readAt: new Date() },
      })

      await notificationService.createNotification(shopId, 'out_of_stock', 'ingredient', item.id, {
        title: `Out of Stock: ${item.name}`,
        description: `Current stock has reached 0 ${item.unitOfMeasure}`,
        ingredientId: item.id,
        ingredientName: item.name,
        navigateTo: '/inventory',
      })
    } else if (item.status === 'low_stock') {
      // Resolve any previous out_of_stock alerts for this item if it was partially restocked to low stock
      await prisma.notification.updateMany({
        where: {
          shopId,
          notifiableType: { in: ['ingredient', 'Ingredient'] },
          notifiableId: item.id,
          type: 'out_of_stock',
          readAt: null,
        },
        data: { readAt: new Date() },
      })

      await notificationService.createNotification(shopId, 'low_stock', 'ingredient', item.id, {
        title: `Low Stock: ${item.name}`,
        description: `Only ${item.quantity} ${item.unitOfMeasure} remaining (threshold: ${item.minAlertThreshold})`,
        ingredientId: item.id,
        ingredientName: item.name,
        targetRole: 'Admin',
        navigateTo: '/inventory',
      })
    } else if (item.status === 'in_stock') {
      // Item is healthy again: auto-resolve any unread stock warnings for this item
      await prisma.notification.updateMany({
        where: {
          shopId,
          notifiableType: { in: ['ingredient', 'Ingredient'] },
          notifiableId: item.id,
          readAt: null,
        },
        data: { readAt: new Date() },
      })
    }
  } catch (err) {
    console.error('⚠️ [notification] checkAndNotifyStockStatus failed:', err)
  }
}

export const inventoryService = {
  async getAll(shopId: number, query: InventoryQueryInput = {}) {
    const search = query.search?.trim()
    const unit = query.unit?.trim()
    const items = await prisma.ingredient.findMany({
      where: {
        shopId,
        ...ACTIVE,
        ...(unit && { unitOfMeasure: unit }),
        ...(search && {
          OR: [{ name: { contains: search } }, { unitOfMeasure: { contains: search } }],
        }),
      },
      orderBy: { updatedAt: 'desc' },
      include: { category: CATEGORY_SELECT },
    })

    const mappedItems = items.map(mapInventoryItem)
    if (!query.status) return mappedItems

    return mappedItems.filter(item => item.status === query.status)
  },

  async create(shopId: number, userId: number, data: CreateInventoryItemInput, imageUrl?: string) {
    const initialCost = toDecimal(getUnitCost(data) ?? 0)
    const initialQuantity = toDecimal(data.quantity)
    const categoryId = getCategoryId(data)
    if (categoryId !== undefined) await assertCategoryInShop(categoryId, shopId)

    // Record the item's cost in whatever currency the shop is configured with.
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { currencySymbol: true },
    })

    // Creating an item with opening stock *is* a stock-in. Logged in the same
    // transaction as the item, otherwise the audit trail starts empty and the
    // history endpoint reports totalIn: 0 for stock that is plainly on hand.
    const item = await prisma.$transaction(async tx => {
      const created = await tx.ingredient.create({
        data: {
          shopId,
          categoryId: categoryId ?? null,
          name: data.name,
          unitOfMeasure: getUnitOfMeasure(data) || 'unit',
          currentStock: initialQuantity,
          lowStockThreshold: getMinAlertThreshold(data) ?? 0,
          unitCost: initialCost,
          lastUnitCost: initialCost,
          costCurrency: shop?.currencySymbol || DEFAULT_COST_CURRENCY,
          imageUrl,
        },
        include: { category: CATEGORY_SELECT },
      })

      if (initialQuantity.greaterThan(0)) {
        await tx.ingredientLog.create({
          data: {
            ingredientId: created.id,
            userId,
            transactionType: 'add',
            quantityChanged: initialQuantity,
            unitCost: initialCost,
            reason: Messages.INITIAL_STOCK,
          },
        })
      }

      return created
    })

    const mapped = mapInventoryItem(item)
    await checkAndNotifyStockStatus(shopId, mapped)
    return mapped
  },

  async update(id: number, shopId: number, data: UpdateInventoryItemInput, imageUrl?: string) {
    await getExistingInventoryItem(id, shopId)

    const categoryId = getCategoryId(data)
    if (categoryId !== undefined) await assertCategoryInShop(categoryId, shopId)

    const unitCost = getUnitCost(data)
    // A manual cost update *establishes* the cost, so the currency label has to
    // follow the shop. Without this, an item whose currency was backfilled to a
    // default would keep showing that symbol against a local-currency figure.
    const shop =
      unitCost === undefined
        ? null
        : await prisma.shop.findUnique({
            where: { id: shopId },
            select: { currencySymbol: true },
          })

    const item = await prisma.ingredient.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(getUnitOfMeasure(data) !== undefined && { unitOfMeasure: getUnitOfMeasure(data) }),
        ...(categoryId !== undefined && { categoryId }),
        ...(data.quantity !== undefined && { currentStock: data.quantity }),
        ...(getMinAlertThreshold(data) !== undefined && {
          lowStockThreshold: getMinAlertThreshold(data),
        }),
        ...(unitCost !== undefined && {
          unitCost,
          lastUnitCost: unitCost,
          costCurrency: shop?.currencySymbol || DEFAULT_COST_CURRENCY,
        }),
        ...(imageUrl !== undefined && { imageUrl }),
      },
      include: { category: CATEGORY_SELECT },
    })

    const mapped = mapInventoryItem(item)
    await checkAndNotifyStockStatus(shopId, mapped)
    return mapped
  },

  async delete(id: number, shopId: number) {
    await getExistingInventoryItem(id, shopId)

    // Soft delete. IngredientLog is an immutable audit trail with a required FK
    // to Ingredient, so a hard delete would mean destroying the item's entire
    // stock history to satisfy the constraint. Stamping deletedAt hides the item
    // from every read path while keeping its movements queryable.
    await prisma.ingredient.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  },

  async adjust(id: number, shopId: number, userId: number, data: AdjustInventoryItemInput) {
    const result = await prisma.$transaction(async tx => {
      // The weighted average is computed in application code from the row's
      // current stock and cost, so a plain read would let two concurrent
      // stock-ins both work from the pre-update snapshot: the increments would
      // both land, but the later unitCost write would overwrite the earlier
      // receipt's contribution. SELECT ... FOR UPDATE serialises them, so each
      // adjustment reads the previous one's committed figures. The stock and
      // cost are read *by the locking query itself* — a separate read afterwards
      // could still be served from the transaction's snapshot.
      const locked = await tx.$queryRaw<
        { current_stock: string | number; unit_cost: string | number }[]
      >`SELECT current_stock, unit_cost FROM ingredients WHERE id = ${id} AND shop_id = ${shopId} AND deleted_at IS NULL FOR UPDATE`

      if (locked.length === 0) {
        throw new AppError(Messages.NOT_FOUND, HttpStatus.NOT_FOUND)
      }

      const changeAmount = toDecimal(data.change_amount)
      const oldStock = toDecimal(locked[0].current_stock)
      const oldCost = toDecimal(locked[0].unit_cost)
      // The cost recorded on the history row: for a stock-in it's the purchase
      // price (defaulting to the current cost when omitted); for a removal it's the
      // average cost consumed, so past spend/consumption can be reconstructed.
      let historyUnitCost: Prisma.Decimal

      if (data.adjustment_type === 'remove') {
        if (oldStock.lessThan(changeAmount)) {
          throw new AppError(Messages.INSUFFICIENT_STOCK, HttpStatus.BAD_REQUEST)
        }

        await tx.ingredient.update({
          where: { id },
          data: {
            currentStock: { decrement: changeAmount },
          },
        })

        historyUnitCost = oldCost
      } else {
        // A stock-in requires a price; when the caller omits it we default to the
        // item's current cost, which leaves the weighted average unchanged.
        const purchaseCost = data.unit_cost == null ? oldCost : toDecimal(data.unit_cost)
        const weightedCost = roundCost(
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
        include: { category: CATEGORY_SELECT },
      })

      return mapInventoryItem(updatedItem)
    })

    await checkAndNotifyStockStatus(shopId, result)
    return result
  },

  // Shop-wide valuation of the whole inventory, independent of any list filters,
  // so the total reflects every item the shop holds.
  async getValuation(shopId: number) {
    const items = await prisma.ingredient.findMany({
      where: { shopId, ...ACTIVE },
      select: { currentStock: true, unitCost: true },
    })

    const totalValue = items.reduce(
      (sum, item) => sum.plus(toDecimal(item.currentStock).times(toDecimal(item.unitCost))),
      toDecimal(0)
    )

    return {
      totalItems: items.length,
      totalValue: roundMoney(totalValue).toNumber(),
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
        quantityChanged: serialize(log.quantityChanged),
        unitCost: log.unitCost === null ? null : serialize(log.unitCost),
        // Monetary value of this movement (qty x unit cost). Null when unitCost
        // is null, same as the Unit Cost column it derives from.
        value:
          log.unitCost === null
            ? null
            : roundMoney(toDecimal(log.quantityChanged).times(toDecimal(log.unitCost))).toNumber(),
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
        totalIn: serialize(addsSum._sum.quantityChanged ?? 0),
        totalOut: serialize(removesSum._sum.quantityChanged ?? 0),
      },
    }
  },
}
