import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { AppError } from '../utils/appError'
import { HttpStatus } from '../constants/httpStatus'
import { Messages } from '../constants/messages'
import { authService } from '../services/authService'

export type AuthUser = {
  user_id: number
  email: string
  shop_id: number
  role: string | null
}

type AuthTokenPayload = JwtPayload & AuthUser

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

const getBearerToken = (req: Request) => {
  const authorizationHeader = req.headers.authorization
  if (authorizationHeader?.startsWith('Bearer ')) {
    const token = authorizationHeader.split(' ')[1]
    if (token) return token
  }

  const queryToken = req.query.token
  if (typeof queryToken === 'string' && queryToken) {
    const isSseRoute = req.path.endsWith('/stream') && req.method === 'GET'
    if (isSseRoute) {
      return queryToken
    }
  }

  throw new AppError(Messages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED)
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req)
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthTokenPayload

    // Check if the token has been blacklisted (logout invalidation)
    const isBlacklisted = await authService.isTokenBlacklisted(token)
    if (isBlacklisted) {
      throw new AppError(Messages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED)
    }

    if (!decoded.user_id || !decoded.email || !decoded.shop_id) {
      throw new AppError(Messages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED)
    }

    // Ensure the user still exists and is active
    const role = await authService.ensureUserIsActive(decoded.user_id)

    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      shop_id: decoded.shop_id,
      role,
    }
    next()
  } catch (error) {
    next(error) // falls through to errorHandler
  }
}
