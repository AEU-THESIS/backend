import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { createShopSchema, updateShopSettingsSchema } from '../validations/shopValidation'
import { shopService } from '../services/shopService'

export const shopController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const body = createShopSchema.parse(req.body)
    const shop = await shopService.create(body)
    return sendSuccess(res, shop, Messages.CREATED, HttpStatus.CREATED)
  }),

  getAll: catchAsync(async (req: Request, res: Response) => {
    const shops = await shopService.getAll()
    return sendSuccess(res, shops)
  }),

  getSettings: catchAsync(async (req: Request, res: Response) => {
    const shop = await shopService.getSettings(req.user!.shop_id)
    return sendSuccess(res, shop)
  }),

  updateSettings: catchAsync(async (req: Request, res: Response) => {
    const body = updateShopSettingsSchema.parse(req.body)
    const shop = await shopService.updateSettings(req.user!.shop_id, body)
    return sendSuccess(res, shop)
  }),
}
