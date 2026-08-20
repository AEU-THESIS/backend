import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/appError'
import { HttpStatus } from '../constants/httpStatus'
import { Messages } from '../constants/messages'
import { verifyTelegramInitData, TelegramUser } from '../utils/telegram'

declare global {
  namespace Express {
    interface Request {
      /** The verified Telegram guest identity on public Mini App routes. */
      telegramUser?: TelegramUser
    }
  }
}

/**
 * Reads the Mini App `initData` from the request and, if its signature is valid,
 * attaches the verified guest to `req.telegramUser`. This is the identity gate
 * for every public ordering route — there is no username/password login for
 * customers; being a genuine Telegram user IS the credential.
 *
 * initData is expected in the `X-Telegram-Init-Data` header (or an
 * `Authorization: tma <initData>` header).
 *
 * Local development without a real bot: when NOT in production AND
 * `TELEGRAM_ALLOW_DEV_INITDATA=true`, an unsigned `X-Dev-Telegram-User` JSON
 * header ({ id, username }) is accepted so the Mini App can be built and tested
 * without Telegram. This bypass is hard-disabled in production.
 */
export const requireTelegramMiniApp = (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Dev-only unsigned bypass (never active in production).
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.TELEGRAM_ALLOW_DEV_INITDATA === 'true'
    ) {
      const devHeader = req.header('x-dev-telegram-user')
      if (devHeader) {
        try {
          const parsed = JSON.parse(devHeader)
          if (parsed?.id !== undefined && parsed?.id !== null) {
            req.telegramUser = {
              id: String(parsed.id),
              username: parsed.username ? String(parsed.username) : undefined,
              firstName: parsed.first_name ? String(parsed.first_name) : undefined,
            }
            return next()
          }
        } catch {
          // fall through to real verification
        }
      }
    }

    const initData = extractInitData(req)
    if (!initData) {
      throw new AppError(Messages.TELEGRAM_AUTH_FAILED, HttpStatus.UNAUTHORIZED)
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? ''
    const user = verifyTelegramInitData(initData, botToken)
    if (!user) {
      throw new AppError(Messages.TELEGRAM_AUTH_FAILED, HttpStatus.UNAUTHORIZED)
    }

    req.telegramUser = user
    next()
  } catch (error) {
    next(error)
  }
}

function extractInitData(req: Request): string | null {
  const header = req.header('x-telegram-init-data')
  if (header) return header

  const auth = req.header('authorization')
  if (auth?.startsWith('tma ')) {
    return auth.slice(4)
  }
  return null
}
