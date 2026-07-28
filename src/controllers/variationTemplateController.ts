import { Request, Response, catchAsync, sendSuccess, HttpStatus } from '../core/Controller'
import { idParamSchema } from '../validations/commonValidation'
import {
  CreateVariationTemplateSchema,
  UpdateVariationTemplateSchema,
  VariationTemplateQuerySchema,
} from '../validations/variationTemplateValidation'
import { variationTemplateService } from '../services/variationTemplateService'
import { AppError } from '../utils/appError'

export const variationTemplateController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    const parsed = VariationTemplateQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('Validation error', HttpStatus.BAD_REQUEST)
    }

    const templates = await variationTemplateService.getByShop(req.user!.shop_id, parsed.data)
    return sendSuccess(res, templates)
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const template = await variationTemplateService.getById(id, req.user!.shop_id)
    return sendSuccess(res, template)
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const data = CreateVariationTemplateSchema.parse(req.body)
    const template = await variationTemplateService.create(
      req.user!.shop_id,
      req.user!.user_id,
      data
    )
    return sendSuccess(res, template, 'Variation template created successfully', HttpStatus.CREATED)
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const data = UpdateVariationTemplateSchema.parse(req.body)
    const template = await variationTemplateService.update(id, req.user!.shop_id, data)
    return sendSuccess(res, template, 'Variation template updated successfully')
  }),

  delete: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const archiveOnly = req.query.archive === 'true'
    const result = await variationTemplateService.delete(id, req.user!.shop_id, archiveOnly)
    return sendSuccess(
      res,
      result,
      archiveOnly ? 'Variation template archived' : 'Variation template deleted'
    )
  }),

  apply: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const group = await variationTemplateService.apply(id, req.user!.shop_id)
    return sendSuccess(res, group, 'Variation template applied')
  }),
}
