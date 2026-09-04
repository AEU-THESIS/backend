import crypto from 'crypto'

/**
 * Telegram helpers: Mini App `initData` verification and the small subset of the
 * Bot API this project uses (posting/editing the staff-group notification and
 * answering inline-button taps).
 *
 * The bot token and target group are read from the environment and never leave
 * the server. `fetch` is used via `globalThis` so no type-lib/DOM dependency is
 * required (Node 18+ provides it at runtime).
 */

export interface TelegramUser {
  /** Numeric Telegram user id, kept as a string (it can exceed 2^53 in theory). */
  id: string
  username?: string
  firstName?: string
  lastName?: string
}

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? ''
const GROUP_CHAT_ID = () => process.env.TELEGRAM_GROUP_CHAT_ID ?? ''
const API_BASE = 'https://api.telegram.org'

/**
 * Verifies a Telegram Mini App `initData` string per the official algorithm:
 * the data-check-string is every field except `hash`, sorted alphabetically and
 * joined by "\n" as `key=value`; the expected hash is
 * HMAC-SHA256(dataCheckString, secretKey) where secretKey =
 * HMAC-SHA256(botToken, "WebAppData"). Also enforces `auth_date` freshness so a
 * captured payload can't be replayed indefinitely.
 *
 * Telegram stamps `auth_date` once when the Mini App is launched and never refreshes
 * it for the life of the session, so the freshness window has to cover a whole
 * browse-and-order session, not a single request. We use 24h (Telegram's own
 * examples do the same) — long enough that a guest who lingers on the menu can still
 * check out, short enough that a leaked payload can't be replayed forever.
 *
 * Returns the verified user, or null if the signature/freshness check fails.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86_400
): TelegramUser | null {
  if (!initData || !botToken) return null

  let params: URLSearchParams
  try {
    params = new URLSearchParams(initData)
  } catch {
    return null
  }

  const hash = params.get('hash')
  if (!hash) return null

  // Build the data-check-string from every field except `hash`.
  const pairs: string[] = []
  params.forEach((value, key) => {
    if (key === 'hash') return
    pairs.push(`${key}=${value}`)
  })
  pairs.sort()
  const dataCheckString = pairs.join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  // Constant-time compare; guard against length mismatch which throws.
  const a = Buffer.from(expectedHash, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null
  }

  // Freshness: reject payloads older than maxAgeSeconds.
  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || authDate <= 0) return null
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate
  if (ageSeconds > maxAgeSeconds) return null

  // Parse the user object.
  const userRaw = params.get('user')
  if (!userRaw) return null
  try {
    const u = JSON.parse(userRaw)
    if (u?.id === undefined || u?.id === null) return null
    return {
      id: String(u.id),
      username: u.username ? String(u.username) : undefined,
      firstName: u.first_name ? String(u.first_name) : undefined,
      lastName: u.last_name ? String(u.last_name) : undefined,
    }
  } catch {
    return null
  }
}

// ── Bot API (server → Telegram) ──────────────────────────────────────────────

type InlineKeyboard = { inline_keyboard: Array<Array<Record<string, unknown>>> }

async function callBotApi(method: string, body: Record<string, unknown>): Promise<any> {
  const token = BOT_TOKEN()
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    let res: any
    try {
      res = await (globalThis as any).fetch(`${API_BASE}/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      // A network/abort error from fetch can carry the request URL (which embeds
      // the bot token) in its message or `cause`. Never let that reach a log or a
      // caller — replace it with a token-free message.
      throw new Error(`Telegram API ${method} request failed (network error)`)
    }
    const json = await res.json()
    if (!json?.ok) {
      throw new Error(`Telegram API ${method} failed: ${json?.description ?? res.status}`)
    }
    return json.result
  } finally {
    clearTimeout(timeout)
  }
}

export const telegram = {
  isConfigured(): boolean {
    return Boolean(BOT_TOKEN() && GROUP_CHAT_ID())
  },

  sendGroupMessage(text: string, replyMarkup?: InlineKeyboard) {
    return callBotApi('sendMessage', {
      chat_id: GROUP_CHAT_ID(),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
  },

  editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    replyMarkup?: InlineKeyboard
  ) {
    return callBotApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      // Passing an empty keyboard removes the buttons once the order is handled.
      ...(replyMarkup ? { reply_markup: replyMarkup } : { reply_markup: { inline_keyboard: [] } }),
    })
  },

  editMessageReplyMarkup(chatId: string | number, messageId: number, replyMarkup: InlineKeyboard) {
    return callBotApi('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    })
  },

  answerCallback(callbackQueryId: string, text?: string) {
    return callBotApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    })
  },

  /** Sends a direct message to a chat (used by the bot command replies). */
  sendMessage(chatId: string | number, text: string, replyMarkup?: InlineKeyboard) {
    return callBotApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
  },

  /**
   * Sends a direct status notification to a customer who placed an order via Telegram.
   * If the customer hasn't started the bot or blocked it, catches safely without failing.
   */
  async notifyCustomer(telegramUserId: string, text: string): Promise<boolean> {
    if (!telegramUserId || !BOT_TOKEN()) return false
    try {
      await callBotApi('sendMessage', {
        chat_id: telegramUserId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      })
      return true
    } catch (err: any) {
      console.warn(
        '⚠️ [telegram bot] Could not deliver customer notification:',
        err?.message ?? err
      )
      return false
    }
  },

  /**
   * Syncs the staff Telegram group notification message when order status changes in the system.
   */
  async syncOrderGroupMessage(order: any, currencySymbol = '$'): Promise<void> {
    if (!order?.telegramMessageId || !BOT_TOKEN()) return
    const chatId = order.telegramChatId || GROUP_CHAT_ID()
    if (!chatId) return

    try {
      const { text, replyMarkup } = buildPreOrderMessage(order, currencySymbol)
      await this.editMessageText(chatId, order.telegramMessageId, text, replyMarkup)
    } catch (err: any) {
      console.warn(
        `⚠️ [telegram bot] Could not sync group message for order #${order.id}:`,
        err?.message ?? err
      )
    }
  },
}

/** Escapes the five characters that matter for Telegram HTML parse mode. */
export function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Bot/customer-facing languages, matching the Mini App i18n locale codes. */
export type CustomerLang = 'en' | 'kh'

/**
 * Builds user-friendly direct notifications sent to the customer on status changes,
 * in the customer's saved language (`lang`; defaults to English). The caller looks
 * up the language via `telegramCustomerService.getLanguage` before calling.
 */
export function buildCustomerStatusNotification(
  order: any,
  status: string,
  currencySymbol = '$',
  lang: CustomerLang = 'en'
): string | null {
  const orderNum = escapeHtml(order.orderNumber ?? '')
  const total = Number(order.totalAmount ?? 0).toFixed(2)
  const kh = lang === 'kh'

  switch (status) {
    case 'preparing':
      return kh
        ? [
            `🎉 <b>ការបញ្ជាទិញរបស់អ្នកត្រូវបានទទួលយក!</b>`,
            ``,
            `ការបញ្ជាទិញ <code>${orderNum}</code> ត្រូវបានហាងទទួលយក ហើយកំពុងរៀបចំ។ ☕`,
            ``,
            `💵 <b>សរុប៖</b> ${currencySymbol}${total}`,
            `យើងនឹងជូនដំណឹងភ្លាមៗ ពេលការបញ្ជាទិញរបស់អ្នករួចរាល់! ✨`,
          ].join('\n')
        : [
            `🎉 <b>Your order has been accepted!</b>`,
            ``,
            `Order <code>${orderNum}</code> has been accepted by the café and is now being prepared. ☕`,
            ``,
            `💵 <b>Total:</b> ${currencySymbol}${total}`,
            `We'll notify you as soon as your order is ready! ✨`,
          ].join('\n')

    case 'ready':
      return kh
        ? [
            `🥤 <b>ការបញ្ជាទិញរបស់អ្នករួចរាល់ហើយ!</b>`,
            ``,
            `ការបញ្ជាទិញ <code>${orderNum}</code> រួចរាល់ហើយ។ សូមអញ្ជើញមកទទួលយក។ 🎉`,
          ].join('\n')
        : [
            `🥤 <b>Your order is ready!</b>`,
            ``,
            `Order <code>${orderNum}</code> is ready. Please come and collect it. 🎉`,
          ].join('\n')

    case 'rejected':
    case 'canceled':
      return kh
        ? [
            `🚫 <b>ព័ត៌មានអំពីការបញ្ជាទិញ</b>`,
            ``,
            `ការបញ្ជាទិញ <code>${orderNum}</code> របស់អ្នកមិនអាចត្រូវបានទទួលយកនៅពេលនេះទេ។`,
            `ប្រសិនបើមានសំណួរ សូមទាក់ទងហាង។`,
          ].join('\n')
        : [
            `🚫 <b>Order Update</b>`,
            ``,
            `Your order <code>${orderNum}</code> could not be accepted by the café at this time.`,
            `Please contact the shop if you have any questions.`,
          ].join('\n')

    default:
      return null
  }
}

/** Inline keyboard offering the two supported languages (callback `setlang:<code>`). */
export function buildLanguageKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🇬🇧 English', callback_data: 'setlang:en' },
        { text: '🇰🇭 ខ្មែរ', callback_data: 'setlang:kh' },
      ],
    ],
  }
}

/** Prompt asking the user to pick a language, shown in both languages. */
export function buildLanguagePrompt(): string {
  return [`🌐 <b>Choose your language</b>`, `សូមជ្រើសរើសភាសារបស់អ្នក`].join('\n')
}

/** Confirmation after a language change, written in the newly chosen language. */
export function buildLanguageConfirmation(lang: CustomerLang): string {
  return lang === 'kh'
    ? `✅ ភាសាត្រូវបានប្តូរទៅ <b>ខ្មែរ</b>។ យើងនឹងផ្ញើដំណឹងអំពីការបញ្ជាទិញជាភាសាខ្មែរ។`
    : `✅ Language set to <b>English</b>. We'll send your order updates in English.`
}

/** Friendly /start greeting (shown in both languages) with the language buttons. */
export function buildStartGreeting(): string {
  return [
    `👋 <b>Welcome to Routine Café & Bakery Orders!</b>`,
    `សូមស្វាគមន៍មកកាន់ Routine Café & Bakery!`,
    ``,
    `Use the button below or /language anytime to change your language.`,
    `ប្រើប៊ូតុងខាងក្រោម ឬ /language ដើម្បីប្តូរភាសា។`,
  ].join('\n')
}

/** A human, emoji-prefixed status line for the group message. */
function preOrderStatusLine(status: string): string {
  switch (status) {
    case 'pending':
      return '🟡 <b>Awaiting acceptance</b>'
    case 'preparing':
      return '🔵 <b>Preparing</b>'
    case 'ready':
      return '🟢 <b>Ready</b>'
    case 'completed':
      return '✔️ <b>Completed &amp; paid</b>'
    case 'rejected':
      return '❌ <b>Rejected</b>'
    case 'canceled':
      return '🚫 <b>Canceled</b>'
    default:
      return ''
  }
}

/**
 * Builds the staff-group notification text + inline buttons for a pre-order.
 * `order` is the full order tree from `orderService.getOrderById`. Reused to
 * re-render the message after each action so the group always shows the live state.
 */
export function buildPreOrderMessage(
  order: any,
  currencySymbol: string
): { text: string; replyMarkup: InlineKeyboard } {
  const lines: string[] = []
  lines.push(`Pre-order — <code>${escapeHtml(order.orderNumber)}</code>`)
  const statusLine = preOrderStatusLine(order.fulfillmentStatus)
  if (statusLine) lines.push(statusLine)
  lines.push('')

  for (const item of order.items ?? []) {
    const name = escapeHtml(item.product?.name ?? `#${item.productId}`)
    const opts = (item.options ?? []).map((o: any) => escapeHtml(o.optionName)).join(', ')
    lines.push(`• ${item.quantity}× ${name}${opts ? ` <i>(${opts})</i>` : ''}`)
  }

  lines.push('')
  lines.push(`💵 Total: ${currencySymbol}${Number(order.totalAmount).toFixed(2)}`)
  if (order.customerName) lines.push(`Customer name:  ${escapeHtml(order.customerName)}`)
  if (order.customerPhone) lines.push(`Phone number: ${escapeHtml(order.customerPhone)}`)
  if (order.telegramUsername) lines.push(`Username: @${escapeHtml(order.telegramUsername)}`)
  if (order.deliveryAddress) lines.push(`📝 ${escapeHtml(order.deliveryAddress)}`)
  if (order.deliveryLat != null && order.deliveryLng != null) {
    const lat = Number(order.deliveryLat)
    const lng = Number(order.deliveryLng)
    lines.push(`📍 <a href="https://maps.google.com/?q=${lat},${lng}">Open location in Maps</a>`)
  }

  return { text: lines.join('\n'), replyMarkup: buildPreOrderKeyboard(order) }
}

/**
 * Stateful inline keyboard for a pre-order — the buttons follow the lifecycle:
 *   pending   → [✅ Accept] [❌ Reject]
 *   preparing → [🥤 Mark ready] [✔️ Complete]
 *   ready     → [✔️ Mark complete]
 *   terminal  → (no action buttons)
 * A "Message customer" link is shown while the order is still active. NOTE: there
 * is deliberately no Block button here — blocking is Admin/Manager-only and is done
 * in the system (Telegram taps can't be role-verified). Exported so the webhook can
 * re-render the keyboard after each action.
 */
export function buildPreOrderKeyboard(order: any): InlineKeyboard {
  const status = order.fulfillmentStatus
  const rows: Array<Array<Record<string, unknown>>> = []

  if (status === 'pending') {
    rows.push([
      { text: '✅ Accept', callback_data: `accept:${order.id}` },
      { text: '❌ Reject', callback_data: `reject:${order.id}` },
    ])
  } else if (status === 'preparing') {
    rows.push([
      { text: '🥤 Mark ready', callback_data: `ready:${order.id}` },
      { text: '✔️ Complete', callback_data: `complete:${order.id}` },
    ])
  } else if (status === 'ready') {
    rows.push([{ text: '✔️ Mark complete', callback_data: `complete:${order.id}` }])
  }

  const active = status === 'pending' || status === 'preparing' || status === 'ready'
  if (order.telegramUsername && active) {
    rows.push([{ text: '💬 Message customer', url: `https://t.me/${order.telegramUsername}` }])
  }

  return { inline_keyboard: rows }
}
