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

export const orderController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.user_id
    const shopId = req.user!.shop_id

    const parsed = CreateOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const result = await orderService.createOrder(userId, shopId, parsed.data)
    return sendSuccess(res, result, Messages.ORDER_CREATED, HttpStatus.CREATED)
  }),
}
