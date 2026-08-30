import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { notificationService } from '../services/notificationService'
import {
  getNotificationQuerySchema,
  notificationIdParamSchema,
  bulkDeleteNotificationSchema,
} from '../validations/notificationValidation'

export const notificationController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const query = getNotificationQuerySchema.parse(req.query)
    const result = await notificationService.getByShop(shopId, query)
    return sendSuccess(res, result, Messages.NOTIFICATIONS_RETRIEVED, HttpStatus.OK)
  }),

  getUnreadCount: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const result = await notificationService.getUnreadCount(shopId)
    return sendSuccess(res, result, Messages.SUCCESS, HttpStatus.OK)
  }),

  markAsRead: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { id } = notificationIdParamSchema.parse(req.params)
    const result = await notificationService.markAsRead(shopId, id)
    return sendSuccess(res, result, Messages.NOTIFICATION_MARKED_READ, HttpStatus.OK)
  }),

  markAllAsRead: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const result = await notificationService.markAllAsRead(shopId)
    return sendSuccess(res, result, Messages.ALL_NOTIFICATIONS_MARKED_READ, HttpStatus.OK)
  }),

  delete: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { id } = notificationIdParamSchema.parse(req.params)
    await notificationService.delete(shopId, id)
    return sendSuccess(res, null, Messages.NOTIFICATION_DELETED, HttpStatus.OK)
  }),

  deleteSelected: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { ids } = bulkDeleteNotificationSchema.parse(req.body)
    const result = await notificationService.deleteSelected(shopId, ids)
    return sendSuccess(res, result, Messages.NOTIFICATION_DELETED, HttpStatus.OK)
  }),

  clearAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const result = await notificationService.clearAll(shopId)
    return sendSuccess(res, result, Messages.ALL_NOTIFICATIONS_CLEARED, HttpStatus.OK)
  }),
}
