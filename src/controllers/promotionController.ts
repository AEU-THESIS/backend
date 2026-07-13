import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import {
  createPromotionSchema,
  updatePromotionSchema,
  getPromotionsQuerySchema,
} from '../validations/promotionValidation'
import { idParamSchema } from '../validations/commonValidation'
import { promotionService } from '../services/promotionService'

export const promotionController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { page, limit, search } = getPromotionsQuerySchema.parse(req.query)
    const result = await promotionService.getByShop(shopId, page, limit, search)
    return sendSuccess(res, result)
  }),

  getOne: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { id } = idParamSchema.parse(req.params)
    const promotion = await promotionService.getById(shopId, id)
    return sendSuccess(res, promotion)
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const body = createPromotionSchema.parse(req.body)
    const promotion = await promotionService.create(shopId, body)
    return sendSuccess(res, promotion, Messages.PROMOTION_CREATED, HttpStatus.CREATED)
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { id } = idParamSchema.parse(req.params)
    const body = updatePromotionSchema.parse(req.body)
    const promotion = await promotionService.update(shopId, id, body)
    return sendSuccess(res, promotion, Messages.PROMOTION_UPDATED)
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { id } = idParamSchema.parse(req.params)
    await promotionService.remove(shopId, id)
    return sendSuccess(res, null, Messages.PROMOTION_DELETED)
  }),
}
