import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { createStaffSchema, updateStaffSchema } from '../validations/userValidation'
import { userService } from '../services/userService'

export const userController = {
  getStaff: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { page, limit, search } = req.query

    const result = await userService.getStaffByShop(
      shopId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      search as string
    )

    return sendSuccess(res, result)
  }),

  createStaff: catchAsync(async (req: Request, res: Response) => {
    const body = createStaffSchema.parse(req.body)
    const shopId = req.user!.shop_id
    const staff = await userService.createStaff(body, shopId)
    return sendSuccess(res, staff, Messages.STAFF_CREATED, HttpStatus.CREATED)
  }),

  updateStaff: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    const body = updateStaffSchema.parse(req.body)
    const shopId = req.user!.shop_id
    const staff = await userService.updateStaff(Number(id), body, shopId)
    return sendSuccess(res, staff, Messages.STAFF_UPDATED)
  }),

  deleteStaff: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    const shopId = req.user!.shop_id
    await userService.deleteStaff(Number(id), shopId)
    return sendSuccess(res, null, Messages.STAFF_DELETED)
  }),
}
