import {
  Request,
  Response,
  AppError,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { categoryService } from '../services/categoryService'
import {
  createCategorySchema,
  updateCategorySchema,
  getCategoryQuerySchema,
} from '../validations/categoryValidation'
import { idParamSchema } from '../validations/commonValidation'

export const categoryController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id

    const categoryPayload = createCategorySchema.parse(req.body)
    const category = await categoryService.create(shopId, categoryPayload)

    return sendSuccess(res, category, Messages.CATEGORY_CREATED, HttpStatus.CREATED)
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const categoryId = Number(req.params.id)

    const id = req.params.id
    if (
      typeof id !== 'string' ||
      !/^\d+$/.test(id) ||
      !Number.isSafeInteger(categoryId) ||
      categoryId <= 0
    ) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const categoryPayload = updateCategorySchema.parse(req.body)
    const category = await categoryService.update(shopId, categoryId, categoryPayload)

    return sendSuccess(res, category, Messages.CATEGORY_UPDATED, HttpStatus.OK)
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { id: categoryId } = idParamSchema.parse(req.params)

    await categoryService.remove(shopId, categoryId)
    return sendSuccess(res, null, Messages.CATEGORY_DELETED, HttpStatus.OK)
  }),

  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const categoryPayload = getCategoryQuerySchema.parse(req.query)
    const categories = await categoryService.getByShop(shopId, categoryPayload)
    return sendSuccess(res, categories)
  }),
}
