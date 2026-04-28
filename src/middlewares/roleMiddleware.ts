import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/appError'
import { HttpStatus } from '../constants/httpStatus'
import { Messages } from '../constants/messages'

export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(Messages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED))
    }

    const hasRole = req.user.role ? allowedRoles.includes(req.user.role) : false

    if (!hasRole) {
      return next(new AppError(Messages.FORBIDDEN, HttpStatus.FORBIDDEN))
    }

    next()
  }
}
