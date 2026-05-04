import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  Messages,
  HttpStatus,
} from '../core/Controller'
import { AppError } from '../utils/appError'
import { roleService } from '../services/roleService'

export const roleController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(Messages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED)
    }

    const shopId = req.user.shop_id
    const roles = await roleService.getRolesByShop(shopId)
    return sendSuccess(res, roles)
  }),
}
