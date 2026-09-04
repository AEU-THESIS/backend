import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import { orderSseController } from '../controllers/orderSseController'
import type { GetNotificationQuery } from '../validations/notificationValidation'

export type NotificationType =
  | 'pre_order'
  | 'new_pre_order'
  | 'low_stock'
  | 'out_of_stock'
  | 'promotion_activated'
  | 'promotion_deactivated'
  | (string & {})

export interface NotificationData {
  title: string
  description: string
  targetRole?: string
  navigateTo?: string
  [key: string]: unknown
}

export interface CreateNotificationParams {
  shopId: number
  type: NotificationType
  notifiableType: string
  notifiableId: number
  data: NotificationData
}

export const notificationService = {
  /**
   * Creates a new notification with deduplication for stock alerts,
   * persists to DB, and broadcasts via SSE to active staff screens.
   * Supports both 5-argument and single object calling signatures.
   */
  async createNotification(
    shopIdOrParams: number | CreateNotificationParams,
    type?: NotificationType,
    notifiableType?: string,
    notifiableId?: number,
    data?: NotificationData
  ) {
    let shopId: number
    let notifType: NotificationType
    let notifEntityType: string
    let notifEntityId: number
    let notifData: NotificationData

    if (typeof shopIdOrParams === 'object') {
      shopId = shopIdOrParams.shopId
      notifType = shopIdOrParams.type
      notifEntityType = shopIdOrParams.notifiableType
      notifEntityId = shopIdOrParams.notifiableId
      notifData = shopIdOrParams.data
    } else {
      shopId = shopIdOrParams
      notifType = type!
      notifEntityType = notifiableType!
      notifEntityId = notifiableId!
      notifData = data!
    }

    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    // Deduplication: prevent duplicate unread alerts for the same ingredient stock condition
    const entityLower = notifEntityType.toLowerCase()
    if (
      (notifType === 'low_stock' || notifType === 'out_of_stock') &&
      entityLower === 'ingredient'
    ) {
      const existingUnread = await prisma.notification.findFirst({
        where: {
          shopId,
          notifiableType: { in: ['ingredient', 'Ingredient'] },
          notifiableId: notifEntityId,
          type: notifType,
          readAt: null,
        },
      })
      if (existingUnread) {
        const updated = await prisma.notification.update({
          where: { id: existingUnread.id },
          data: {
            data: notifData as any,
            createdAt: new Date(),
          },
        })
        orderSseController.safeBroadcastToShop(shopId, 'notification_created', updated)
        return updated
      }
    }

    const notification = await prisma.notification.create({
      data: {
        shopId,
        type: notifType,
        notifiableType: notifEntityType,
        notifiableId: notifEntityId,
        data: notifData as any,
      },
    })

    orderSseController.safeBroadcastToShop(shopId, 'notification_created', notification)

    return notification
  },

  /**
   * Retrieves paginated notifications for the shop, optionally filtered by read status.
   */
  async getByShop(shopId: number, query: Partial<GetNotificationQuery> = {}) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit

    const where: any = { shopId }
    if (query.read !== undefined) {
      where.readAt = query.read ? { not: null } : null
    }
    if (query.type) {
      where.type = query.type
    }

    const [rawNotifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ])

    const notifications = rawNotifications.map(n => ({
      ...n,
      data: typeof n.data === 'string' ? JSON.parse(n.data) : n.data || {},
    }))

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    }
  },

  /**
   * Returns unread notification count for lightweight initial page loads.
   */
  async getUnreadCount(shopId: number) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const count = await prisma.notification.count({
      where: {
        shopId,
        readAt: null,
      },
    })

    return { count }
  },

  /**
   * Marks a single notification as read by setting readAt = now().
   */
  async markAsRead(shopId: number, id: number) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const notification = await prisma.notification.findFirst({
      where: { id, shopId },
    })

    if (!notification) {
      throw new AppError(Messages.NOTIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (notification.readAt) {
      return notification
    }

    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    })
  },

  /**
   * Marks all unread notifications for the shop as read.
   */
  async markAllAsRead(shopId: number) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const result = await prisma.notification.updateMany({
      where: {
        shopId,
        readAt: null,
      },
      data: { readAt: new Date() },
    })

    return { count: result.count, updated: result.count }
  },

  /**
   * Deletes a single notification for the shop.
   */
  async delete(shopId: number, id: number) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const notification = await prisma.notification.findFirst({
      where: { id, shopId },
    })

    if (!notification) {
      throw new AppError(Messages.NOTIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    return prisma.notification.delete({
      where: { id },
    })
  },

  /**
   * Bulk deletes selected notifications by IDs for the shop.
   */
  async deleteSelected(shopId: number, ids: number[]) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const result = await prisma.notification.deleteMany({
      where: {
        shopId,
        id: { in: ids },
      },
    })

    return { deleted: result.count }
  },

  /**
   * Clears all notifications for the shop.
   */
  async clearAll(shopId: number) {
    if (!shopId || shopId <= 0) {
      throw new AppError(Messages.INVALID_SHOP_SCOPE, HttpStatus.FORBIDDEN)
    }

    const result = await prisma.notification.deleteMany({
      where: { shopId },
    })

    return { deleted: result.count }
  },
}
