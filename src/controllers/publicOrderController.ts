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
import {
  CreatePreOrderSchema,
  SetLanguageSchema,
  ShopSlugParamsSchema,
} from '../validations/publicOrderValidation'
import prisma from '../config/database'
import { buildPreOrderMessage, telegram } from '../utils/telegram'
import { telegramCustomerService } from '../services/telegramCustomerService'

/**
 * Public (Telegram Mini App) ordering endpoints. All routes are gated by
 * `requireTelegramMiniApp`, so `req.telegramUser` is always the verified guest.
 * The menu is world-readable for the shop's slug; ordering is write-only and
 * reading is scoped to the guest's own orders.
 */
export const publicOrderController = {
  getMenu: catchAsync(async (req: Request, res: Response) => {
    const { slug } = ShopSlugParamsSchema.parse(req.params)
    const telegramUser = req.telegramUser
    const shop = await publicOrderService.resolveShopBySlug(slug)

    // Immediate gate: if blocked, refuse menu access right away
    if (telegramUser && (await telegramCustomerService.isBlocked(shop.id, telegramUser.id))) {
      throw new AppError(Messages.CUSTOMER_BLOCKED, HttpStatus.FORBIDDEN)
    }

    const menu = await publicOrderService.getMenu(shop)
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

    // Remember the guest's contact details for faster checkout next time (best-effort).
    telegramCustomerService
      .rememberContact(telegramUser.id, {
        name: parsed.data.customerName,
        phone: parsed.data.customerPhone,
        telegramUsername: telegramUser.username ?? null,
      })
      .catch(() => {})

    // Fire-and-forget side effects: notify staff screens (SSE) and post the
    // Telegram group alert. Neither may ever fail the customer's order.
    ;(async () => {
      try {
        const fullOrder = await orderService.getOrderById(shop.id, result.id)
        orderSseController.safeBroadcastToShop(shop.id, 'order_created', fullOrder)

        if (telegram.isConfigured()) {
          const { text, replyMarkup } = buildPreOrderMessage(fullOrder, shop.currencySymbol)
          const sent = await telegram.sendGroupMessage(text, replyMarkup)
          if (sent?.message_id && sent?.chat?.id) {
            await prisma.order.update({
              where: { id: result.id },
              data: {
                telegramMessageId: sent.message_id,
                telegramChatId: String(sent.chat.id),
              },
            })
          }
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

    if (await telegramCustomerService.isBlocked(shop.id, telegramUser.id)) {
      throw new AppError(Messages.CUSTOMER_BLOCKED, HttpStatus.FORBIDDEN)
    }

    const page = req.query.page ? Number(req.query.page) : 1
    const limit = req.query.limit ? Number(req.query.limit) : 10

    const result = await publicOrderService.getMyOrders(shop.id, telegramUser.id, page, limit)
    return sendSuccess(
      res,
      {
        orders: result.orders,
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        hasMore: result.hasMore,
      },
      Messages.PREORDERS_RETRIEVED,
      HttpStatus.OK
    )
  }),

  /**
   * The verified guest's remembered profile — name, phone, and language — used by
   * the Mini App to pre-fill checkout and sync the language toggle. Shop-agnostic:
   * the profile belongs to the Telegram user, not a shop.
   */
  getMyProfile: catchAsync(async (req: Request, res: Response) => {
    const telegramUser = req.telegramUser!
    const profile = await telegramCustomerService.getProfile(telegramUser.id)
    // Personal contact data tied to one Telegram identity — never let a shared
    // cache serve it to another guest when the Mini App switches user.
    res.set('Cache-Control', 'no-store')
    return sendSuccess(res, profile, Messages.PROFILE_RETRIEVED, HttpStatus.OK)
  }),

  /** Persists the guest's language choice from the Mini App toggle. */
  setMyLanguage: catchAsync(async (req: Request, res: Response) => {
    const telegramUser = req.telegramUser!
    const parsed = SetLanguageSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(Messages.VALIDATION_ERROR, HttpStatus.BAD_REQUEST)
    }

    const language = await telegramCustomerService.setLanguage(
      telegramUser.id,
      parsed.data.language,
      telegramUser.username ?? null
    )
    return sendSuccess(res, { language }, Messages.LANGUAGE_UPDATED, HttpStatus.OK)
  }),
}
