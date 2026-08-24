import { Router } from 'express'
import { publicOrderController } from '../controllers/publicOrderController'
import { orderSseController } from '../controllers/orderSseController'
import { telegramWebhookController } from '../controllers/telegramWebhookController'
import { requireTelegramMiniApp } from '../middlewares/telegramMiniAppMiddleware'
import { publicOrderLimiter, publicReadLimiter } from '../middlewares/rateLimiterMiddleware'

/**
 * Public customer-facing routes for the Telegram Mini App pre-order flow. Mounted
 * at `/api/public`. These are NOT staff-authenticated:
 *  - the Mini App routes are gated by verified Telegram `initData`
 *    (`requireTelegramMiniApp`), which supplies the guest identity;
 *  - the Telegram webhook is server-to-server and verifies a secret token itself.
 */
const router = Router()

// Telegram → server (inline-button taps). Secret-token verified in the controller.
router.post('/telegram/webhook', telegramWebhookController.handleUpdate)

// Mini App (customer) endpoints — verified Telegram guest required.
router.get(
  '/shops/:slug/menu',
  requireTelegramMiniApp,
  publicReadLimiter,
  publicOrderController.getMenu
)
router.post(
  '/shops/:slug/orders',
  requireTelegramMiniApp,
  publicOrderLimiter,
  publicOrderController.createPreOrder
)
router.get(
  '/shops/:slug/orders/mine',
  requireTelegramMiniApp,
  publicReadLimiter,
  publicOrderController.getMyOrders
)

// Public SSE stream for real-time order status updates (replaces continuous polling)
router.get('/shops/:slug/orders/sse', (req, res) => orderSseController.subscribePublic(req, res))

export default router
