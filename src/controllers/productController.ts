import {
  Request,
  Response,
  NextFunction,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { productService } from '../services/productService'
import { ProductQuerySchema } from '../validations/productValidation'
import { AppError } from '../utils/appError'

export const productController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const parsed = ProductQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    const products = await productService.getByShop(shopId, parsed.data)
    return sendSuccess(res, products)
  }),
}
