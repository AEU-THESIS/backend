import {
  Request,
  Response,
  NextFunction,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { orderService } from '../services/orderService'
import {
  CreateOrderSchema,
  GetOrdersQuerySchema,
  GetOrderParamsSchema,
  UpdateOrderStatusSchema,
  VoidOrderSchema,
  CancelOrderItemParamsSchema,
} from '../validations/orderValidation'
import { AppError } from '../utils/appError'
import { orderSseController } from './orderSseController'
import { telegram } from '../utils/telegram'
import { telegramCustomerService } from '../services/telegramCustomerService'

export const orderController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.user_id
    const shopId = req.user!.shop_id

    const parsed = CreateOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const result = await orderService.createOrder(userId, shopId, parsed.data)

    // Broadcast the newly created full order tree to connected kitchen staff asynchronously
    ;(async () => {
      try {
        const fullOrder = await orderService.getOrderById(shopId, result.id)
        orderSseController.safeBroadcastToShop(shopId, 'order_created', fullOrder)
      } catch (sseError) {
        console.error('⚠️ [SSE] Failed to broadcast new order to kitchen:', sseError)
      }
    })()

    return sendSuccess(res, result, Messages.ORDER_CREATED, HttpStatus.CREATED)
  }),

  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id

    const parsed = GetOrdersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const result = await orderService.getAllOrders(shopId, parsed.data, {
      userId: req.user!.user_id,
      role: req.user!.role,
    })

    return sendSuccess(res, result, Messages.ORDERS_RETRIEVED, HttpStatus.OK)
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id

    const parsed = GetOrderParamsSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const order = await orderService.getOrderById(shopId, parsed.data.id)
    return sendSuccess(res, order, Messages.ORDER_RETRIEVED, HttpStatus.OK)
  }),

  updateStatus: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id

    const parsed = UpdateOrderStatusSchema.safeParse({
      id: Number(req.params.id),
      status: req.body.status,
    })

    if (!parsed.success) {
      const errorMap = parsed.error.flatten().fieldErrors
      if (errorMap.id) {
        throw new AppError(Messages.INVALID_ORDER_ID, HttpStatus.BAD_REQUEST)
      }
      if (errorMap.status) {
        throw new AppError(Messages.STATUS_REQUIRED, HttpStatus.BAD_REQUEST)
      }
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const updatedOrder = await orderService.updateOrderStatus(
      shopId,
      parsed.data.id,
      parsed.data.status
    )

    // Broadcast the status update to all connected screens instantly
    orderSseController.safeBroadcastToShop(shopId, 'order_updated', updatedOrder)

    // Sync Telegram group notification message & buttons in real time
    telegram.syncOrderGroupMessage(updatedOrder).catch(() => {})

    // Notify the customer (in their language) if this was a Telegram Mini App order.
    void telegramCustomerService.notifyOrderStatus(updatedOrder, parsed.data.status)

    return sendSuccess(res, updatedOrder, Messages.ORDER_STATUS_UPDATED, HttpStatus.OK)
  }),

  void: catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.user_id
    const shopId = req.user!.shop_id

    const params = GetOrderParamsSchema.safeParse(req.params)
    if (!params.success) {
      throw new AppError(Messages.INVALID_ORDER_ID, HttpStatus.BAD_REQUEST)
    }
    const body = VoidOrderSchema.safeParse(req.body ?? {})
    if (!body.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const order = await orderService.voidOrder(shopId, params.data.id, userId, body.data.reason)

    // Push the reversed order to every connected screen so boards/history refresh live.
    orderSseController.safeBroadcastToShop(shopId, 'order_updated', order)

    // Sync Telegram group notification message & buttons in real time
    telegram.syncOrderGroupMessage(order).catch(() => {})

    void telegramCustomerService.notifyOrderStatus(order, 'canceled')

    return sendSuccess(res, order, Messages.ORDER_VOIDED, HttpStatus.OK)
  }),

  // Reject a pending customer pre-order from the staff Pre-Orders board (the
  // board's counterpart to the Telegram "Block" action, minus the block-list).
  // Safe with no refund because a pre-order is unpaid.
  rejectPreOrder: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id

    const params = GetOrderParamsSchema.safeParse(req.params)
    if (!params.success) {
      throw new AppError(Messages.INVALID_ORDER_ID, HttpStatus.BAD_REQUEST)
    }

    const order = await orderService.rejectPreOrder(shopId, params.data.id)
    orderSseController.safeBroadcastToShop(shopId, 'order_updated', order)

    // Sync Telegram group notification message & buttons in real time
    telegram.syncOrderGroupMessage(order).catch(() => {})

    // Notify the customer (in their language) if this was a Telegram Mini App order.
    void telegramCustomerService.notifyOrderStatus(order, 'rejected')

    return sendSuccess(res, order, Messages.ORDER_STATUS_UPDATED, HttpStatus.OK)
  }),

  cancelItem: catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.user_id
    const shopId = req.user!.shop_id

    const params = CancelOrderItemParamsSchema.safeParse(req.params)
    if (!params.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const order = await orderService.cancelOrderItem(
      shopId,
      params.data.id,
      params.data.itemId,
      userId
    )

    orderSseController.safeBroadcastToShop(shopId, 'order_updated', order)

    // Sync Telegram group notification message & buttons in real time
    telegram.syncOrderGroupMessage(order).catch(() => {})

    return sendSuccess(res, order, Messages.ORDER_ITEM_CANCELED, HttpStatus.OK)
  }),
}
