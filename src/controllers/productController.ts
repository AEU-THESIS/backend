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
import {
  ProductQuerySchema,
  UpdateProductSchema,
  CreateProductSchema,
} from '../validations/productValidation'
import { AppError } from '../utils/appError'

export const productController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id

    const productPayload = CreateProductSchema.parse(req.body)
    const product = await productService.create(shopId, productPayload)

    return sendSuccess(res, product, Messages.PRODUCT_CREATED, HttpStatus.CREATED)
  }),

  getAll: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const parsed = ProductQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    const products = await productService.getByShop(shopId, parsed.data)
    return sendSuccess(res, products)
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id

    const id = req.params.id
    if (typeof id !== 'string' || !/^\d+$/.test(id)) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    const productId = Number(id)

    const product = await productService.getById(productId, shopId)
    return sendSuccess(res, product, Messages.SUCCESS, HttpStatus.OK)
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const productId = parseInt(String(req.params.id), 10)

    if (isNaN(productId)) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const parsed = UpdateProductSchema.safeParse(req.body)

    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const product = await productService.update(productId, shopId, parsed.data)
    return sendSuccess(res, product, 'Product updated successfully', HttpStatus.OK)
  }),
}
