import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { AppError } from '../utils/appError'
import { telegramCustomerService } from '../services/telegramCustomerService'
import {
  BlockCustomerSchema,
  TelegramUserIdParamSchema,
} from '../validations/blockedCustomerValidation'

export const blockedCustomerController = {
  // Block a Telegram customer (Admin/Manager). blockedUntil omitted = forever.
  create: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const parsed = BlockCustomerSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    let blockedUntil: Date | null = null
    if (parsed.data.blockedUntil) {
      const d = new Date(parsed.data.blockedUntil)
      if (Number.isNaN(d.getTime())) {
        throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
      }
      blockedUntil = d
    }

    await telegramCustomerService.block(shopId, parsed.data.telegramUserId, {
      blockedUntil,
      reason: parsed.data.reason ?? null,
      telegramUsername: parsed.data.telegramUsername ?? null,
    })

    return sendSuccess(res, { blocked: true }, Messages.CUSTOMER_BLOCKED_ADDED, HttpStatus.CREATED)
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const rows = await telegramCustomerService.list(shopId)
    return sendSuccess(res, rows, Messages.SUCCESS)
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const parsed = TelegramUserIdParamSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }
    await telegramCustomerService.unblock(shopId, parsed.data.telegramUserId)
    return sendSuccess(res, { unblocked: true }, Messages.CUSTOMER_BLOCK_REMOVED)
  }),
}
