import rateLimit from 'express-rate-limit'

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
