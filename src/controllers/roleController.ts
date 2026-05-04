import { Request, Response, catchAsync, sendSuccess } from '../core/Controller'
import { roleService } from '../services/roleService'

export const roleController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const roles = await roleService.getRolesByShop(shopId)
    return sendSuccess(res, roles)
  }),
}
