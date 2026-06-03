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
import { CreateOrderSchema } from '../validations/orderValidation'
import { AppError } from '../utils/appError'
import { orderSseController } from './orderSseController'

export const orderController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.user_id
    const shopId = req.user!.shop_id

    const parsed = CreateOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const result = await orderService.createOrder(userId, shopId, parsed.data)

    // Broadcast the newly created full order tree to connected kitchen staff
    try {
      const fullOrder = await orderService.getOrderById(shopId, result.id)
      orderSseController.broadcastToShop(shopId, 'order_created', fullOrder)
    } catch (sseError) {
      console.error('⚠️ [SSE] Failed to broadcast new order to kitchen:', sseError)
    }

    return sendSuccess(res, result, Messages.ORDER_CREATED, HttpStatus.CREATED)
  }),

  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { status, paymentStatus, date, search, startDate, endDate, page, limit } = req.query

    const result = await orderService.getAllOrders(shopId, {
      status: status ? String(status) : undefined,
      paymentStatus: paymentStatus ? String(paymentStatus) : undefined,
      date: date ? String(date) : undefined,
      search: search ? String(search) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })

    return sendSuccess(res, result, 'Orders retrieved successfully')
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const id = Number(req.params.id)

    if (isNaN(id)) {
      throw new AppError('Invalid order ID', HttpStatus.BAD_REQUEST)
    }

    const order = await orderService.getOrderById(shopId, id)
    return sendSuccess(res, order, 'Order retrieved successfully')
  }),

  updateStatus: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const id = Number(req.params.id)
    const { status } = req.body

    if (isNaN(id)) {
      throw new AppError('Invalid order ID', HttpStatus.BAD_REQUEST)
    }

    if (!status) {
      throw new AppError('Status is required', HttpStatus.BAD_REQUEST)
    }

    const updatedOrder = await orderService.updateOrderStatus(shopId, id, status)

    // Broadcast the status update to all connected screens instantly
    try {
      orderSseController.broadcastToShop(shopId, 'order_updated', updatedOrder)
    } catch (sseError) {
      console.error('⚠️ [SSE] Failed to broadcast order status update:', sseError)
    }

    return sendSuccess(res, updatedOrder, 'Order status updated successfully')
  }),
}
