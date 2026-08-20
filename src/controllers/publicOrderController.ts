import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { AppError } from '../utils/appError'
import { publicOrderService } from '../services/publicOrderService'
import { orderService } from '../services/orderService'
import { orderSseController } from './orderSseController'
import { CreatePreOrderSchema, ShopSlugParamsSchema } from '../validations/publicOrderValidation'
import { buildPreOrderMessage, telegram } from '../utils/telegram'

/**
 * Public (Telegram Mini App) ordering endpoints. All routes are gated by
 * `requireTelegramMiniApp`, so `req.telegramUser` is always the verified guest.
 * The menu is world-readable for the shop's slug; ordering is write-only and
 * reading is scoped to the guest's own orders.
 */
export const publicOrderController = {
  getMenu: catchAsync(async (req: Request, res: Response) => {
    const { slug } = ShopSlugParamsSchema.parse(req.params)
    const menu = await publicOrderService.getMenu(slug)
    return sendSuccess(res, menu, Messages.MENU_RETRIEVED)
  }),

  createPreOrder: catchAsync(async (req: Request, res: Response) => {
    const { slug } = ShopSlugParamsSchema.parse(req.params)
    const telegramUser = req.telegramUser! // guaranteed by requireTelegramMiniApp
    const shop = await publicOrderService.resolveShopBySlug(slug)

    const parsed = CreatePreOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const result = await orderService.createPreOrder(
      shop.id,
      { id: telegramUser.id, username: telegramUser.username },
      parsed.data
    )

    // Fire-and-forget side effects: notify staff screens (SSE) and post the
    // Telegram group alert. Neither may ever fail the customer's order.
    ;(async () => {
      try {
        const fullOrder = await orderService.getOrderById(shop.id, result.id)
        orderSseController.safeBroadcastToShop(shop.id, 'order_created', fullOrder)
        if (telegram.isConfigured()) {
          const { text, replyMarkup } = buildPreOrderMessage(fullOrder, shop.currencySymbol)
          await telegram.sendGroupMessage(text, replyMarkup)
        }
      } catch (err) {
        console.error('⚠️ [pre-order] post-create side effects failed:', err)
      }
    })()

    return sendSuccess(res, result, Messages.PREORDER_CREATED, HttpStatus.CREATED)
  }),

  getMyOrders: catchAsync(async (req: Request, res: Response) => {
    const { slug } = ShopSlugParamsSchema.parse(req.params)
    const telegramUser = req.telegramUser!
    const shop = await publicOrderService.resolveShopBySlug(slug)
    const orders = await publicOrderService.getMyOrders(shop.id, telegramUser.id)
    return sendSuccess(res, orders, Messages.PREORDERS_RETRIEVED)
  }),
}
