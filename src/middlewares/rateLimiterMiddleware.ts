import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

/**
 * Strict limiter for password reset flows (Forgot Password & Reset Password)
 * Limits each IP to 5 attempts per hour to prevent abuse and brute-force.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again after an hour.',
  },
})

/**
 * Strict limiter for login attempts
 * Limits each IP to 10 attempts per 15 minutes.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
})

/**
 * Limiter for image upload/delete endpoints.
 * Image processing (sharp) and disk writes are resource-intensive, so we cap
 * each IP to 30 requests per 15 minutes on top of the global API limiter.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many upload requests. Please try again later.',
  },
})

/**
 * Limiter for the public Telegram Mini App pre-order endpoint. Keyed on the
 * verified Telegram user when present (so one guest can't spam), falling back to
 * the client IP. Must run AFTER `requireTelegramMiniApp` so `req.telegramUser` is
 * populated. 10 orders / minute is generous for a real customer but stops abuse.
 */
export const publicOrderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    const tgId = req.telegramUser?.id
    return tgId ? `tg:${tgId}` : ipKeyGenerator(req.ip ?? '')
  },
  message: {
    success: false,
    message: 'Too many orders in a short time. Please wait a moment and try again.',
  },
})

/**
 * Light limiter for the public Mini App read endpoints (menu, my-orders). These
 * only read data but the menu query is broad, so cap browsing traffic per guest
 * (falling back to IP). Generous enough for normal browsing/refreshing. Must run
 * AFTER `requireTelegramMiniApp` so `req.telegramUser` is populated.
 */
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    const tgId = req.telegramUser?.id
    return tgId ? `tg:${tgId}` : ipKeyGenerator(req.ip ?? '')
  },
  message: {
    success: false,
    message: 'Too many requests. Please wait a moment and try again.',
  },
})
