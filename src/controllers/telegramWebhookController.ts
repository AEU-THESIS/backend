import crypto from 'crypto'
import { Request, Response } from 'express'
import { orderService } from '../services/orderService'
import { orderSseController } from './orderSseController'
import { telegram, buildPreOrderMessage } from '../utils/telegram'

/** Constant-time string compare that tolerates length mismatch without throwing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Telegram webhook: handles the staff-group inline-button taps so staff can move a
 * pre-order through its lifecycle without opening the system:
 *   accept:<id>   → preparing
 *   reject:<id>   → rejected
 *   ready:<id>    → ready
 *   complete:<id> → completed (settles the COD payment to paid)
 * After each action the group message is re-rendered to show the new status and the
 * next available buttons.
 *
 * IMPORTANT — no role check is possible here: a Telegram callback identifies the
 * tapper's Telegram account, which we can't map to a system role. So these actions
 * are trusted to whoever is in the staff group (keep it staff-only). Blocking a
 * customer is deliberately NOT exposed here — it's an Admin/Manager action performed
 * in the system.
 *
 * Telegram expects a prompt 2xx or it retries, so every path answers 200 after
 * handling — except a bad secret token, which is rejected outright.
 */

const ACTION_TO_STATUS: Record<string, string> = {
  accept: 'preparing',
  ready: 'ready',
  complete: 'completed',
}

export const telegramWebhookController = {
  async handleUpdate(req: Request, res: Response) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET
    const got = req.header('x-telegram-bot-api-secret-token')
    if (!expected || !got || !safeEqual(got, expected)) {
      return res.status(403).json({ ok: false })
    }

    const cb = req.body?.callback_query
    if (!cb) {
      return res.status(200).json({ ok: true })
    }

    try {
      const [action, idRaw] = String(cb.data ?? '').split(':')
      const orderId = Number(idRaw)
      const chatId = cb.message?.chat?.id
      const messageId = cb.message?.message_id

      // Defense-in-depth: this endpoint changes order state (incl. settling COD to
      // paid on complete), so only honour taps coming from the configured staff
      // group. A configured group id that doesn't match the callback's chat is
      // acknowledged silently and ignored.
      const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID
      if (groupChatId && String(chatId) !== String(groupChatId)) {
        await telegram.answerCallback(cb.id)
        return res.status(200).json({ ok: true })
      }

      if (!Number.isInteger(orderId) || orderId <= 0) {
        await telegram.answerCallback(cb.id, 'Invalid action')
        return res.status(200).json({ ok: true })
      }

      const ctx = await orderService.getOrderContext(orderId)
      const currency = ctx.shop?.currencySymbol ?? '$'

      let toast = ''
      if (action === 'reject') {
        await orderService.rejectPreOrder(ctx.shopId, orderId)
        toast = 'Pre-order rejected 🚫'
      } else if (action in ACTION_TO_STATUS) {
        await orderService.updateOrderStatus(ctx.shopId, orderId, ACTION_TO_STATUS[action])
        toast =
          action === 'accept'
            ? 'Accepted — now preparing ☕'
            : action === 'ready'
              ? 'Marked ready 🥤'
              : 'Completed & marked paid ✔️'
      } else {
        await telegram.answerCallback(cb.id)
        return res.status(200).json({ ok: true })
      }

      // Re-render the group message with the new status + next-step buttons, and push
      // the change to any open staff screens.
      const fullOrder = await orderService.getOrderById(ctx.shopId, orderId)
      orderSseController.safeBroadcastToShop(ctx.shopId, 'order_updated', fullOrder)
      await telegram.answerCallback(cb.id, toast)
      if (chatId && messageId) {
        const { text, replyMarkup } = buildPreOrderMessage(fullOrder, currency)
        await telegram.editMessageText(chatId, messageId, text, replyMarkup)
      }
    } catch (err) {
      console.error('⚠️ [telegram webhook] failed to handle callback:', err)
      try {
        await telegram.answerCallback(req.body.callback_query.id, 'Could not complete that action')
      } catch {
        // best effort to stop the button spinner
      }
    }

    return res.status(200).json({ ok: true })
  },
}
