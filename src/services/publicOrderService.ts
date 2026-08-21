import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import { productService } from './productService'
import { promotionService } from './promotionService'

/**
 * Read-side logic for the public Telegram Mini App: resolving a shop from its
 * public slug, serving the customer-facing menu, and letting a guest read back
 * their own pre-orders. Everything here is deliberately read-only and shop-scoped;
 * writes go through `orderService.createPreOrder`.
 */
export const publicOrderService = {
  /** Resolves a shop by its public slug, exposing only display-safe fields. */
  async resolveShopBySlug(slug: string) {
    const shop = await prisma.shop.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        currencySymbol: true,
      },
    })
    if (!shop) {
      throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.NOT_FOUND)
    }
    return shop
  },

  /**
   * Customer-facing menu for a shop: active categories + available products (with
   * their option sets) + active promotions. Internal fields (cost, stock, recipes)
   * are never exposed — `productService.mapProducts` already returns only display-safe product data.
   */
  async getMenu(slug: string) {
    const shop = await this.resolveShopBySlug(slug)

    const [categories, products, promotions] = await Promise.all([
      prisma.category.findMany({
        where: { shopId: shop.id, isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, sortOrder: true },
      }),
      prisma.product.findMany({
        where: { shopId: shop.id, isAvailable: true },
        include: {
          category: { select: { id: true, name: true } },
          optionSets: {
            include: {
              optionSet: { include: { elements: { orderBy: { position: 'asc' } } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      promotionService.getActiveByShop(shop.id),
    ])

    return {
      shop,
      categories,
      products: productService.mapProducts(products),
      promotions,
    }
  },

  /**
   * A guest's own pre-orders, matched by their verified Telegram id. Returns only
   * this customer's orders with pagination support for infinite scrolling.
   */
  async getMyOrders(shopId: number, telegramUserId: string, page = 1, limit = 10) {
    const p = Math.max(1, Number(page) || 1)
    const l = Math.min(50, Math.max(1, Number(limit) || 10))
    const skip = (p - 1) * l

    const [total, orders] = await Promise.all([
      prisma.order.count({
        where: { shopId, telegramUserId, orderType: 'pre_order' },
      }),
      prisma.order.findMany({
        where: { shopId, telegramUserId, orderType: 'pre_order' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          fulfillmentStatus: true,
          paymentStatus: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              quantity: true,
              product: { select: { name: true } },
              options: { select: { optionName: true } },
            },
          },
        },
      }),
    ])

    const totalPages = Math.ceil(total / l)

    return {
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: Number(o.totalAmount),
        fulfillmentStatus: o.fulfillmentStatus,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        items: o.items.map(it => ({
          id: it.id,
          quantity: it.quantity,
          name: it.product?.name ?? '',
          options: it.options.map(op => op.optionName),
        })),
      })),
      total,
      totalPages,
      page: p,
      limit: l,
      hasMore: p < totalPages,
    }
  },
}
