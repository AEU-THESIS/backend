import {
  Request,
  Response,
  NextFunction,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { categoryService } from '../services/categoryService'

export const categoryController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const categories = await categoryService.getByShop(shopId)
    return sendSuccess(res, categories)
  }),
}
