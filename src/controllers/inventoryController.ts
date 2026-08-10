import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { idParamSchema } from '../validations/commonValidation'
import {
  adjustInventoryItemSchema,
  createInventoryItemSchema,
  inventoryHistoryQuerySchema,
  inventoryQuerySchema,
  updateInventoryItemSchema,
} from '../validations/inventoryValidation'
import { inventoryService } from '../services/inventoryService'
import { processImage } from '../utils/fileUpload'

const getUploadedImageUrl = async (req: Request) => {
  if (!req.file) return undefined
  return processImage(req.file.buffer)
}

export const inventoryController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    const query = inventoryQuerySchema.parse(req.query)
    const result = await inventoryService.getAll(req.user!.shop_id, query)
    return sendSuccess(res, result)
  }),

  getValuation: catchAsync(async (req: Request, res: Response) => {
    const valuation = await inventoryService.getValuation(req.user!.shop_id)
    return sendSuccess(res, valuation)
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const body = createInventoryItemSchema.parse(req.body)
    const imageUrl = await getUploadedImageUrl(req)
    const item = await inventoryService.create(req.user!.shop_id, body, imageUrl)
    return sendSuccess(res, item, Messages.CREATED, HttpStatus.CREATED)
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const body = updateInventoryItemSchema.parse(req.body)
    const imageUrl = await getUploadedImageUrl(req)
    const item = await inventoryService.update(id, req.user!.shop_id, body, imageUrl)
    return sendSuccess(res, item)
  }),

  delete: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    await inventoryService.delete(id, req.user!.shop_id)
    return sendSuccess(res, null)
  }),

  adjust: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const body = adjustInventoryItemSchema.parse(req.body)
    const item = await inventoryService.adjust(id, req.user!.shop_id, req.user!.user_id, body)
    return sendSuccess(res, item)
  }),

  getHistory: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const query = inventoryHistoryQuerySchema.parse(req.query)
    const history = await inventoryService.getHistory(id, req.user!.shop_id, query)
    return sendSuccess(res, history)
  }),
}
