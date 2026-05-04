import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import type { SignOptions } from 'jsonwebtoken'
import type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validations/authValidation'
import { emailService } from './emailService'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn']

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export const authService = {
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        roles: {
          include: { role: true },
        },
      },
    })

    if (!user) {
      throw new AppError(Messages.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED)
    }

    if (!user.isActive) {
      throw new AppError(
        'Your account has been deactivated. Please contact an administrator.',
        HttpStatus.FORBIDDEN
      )
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password)
    if (!isPasswordValid) {
      throw new AppError(Messages.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED)
    }

    const role = user.roles[0]?.role.name || null

    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        shop_id: user.shopId,
        role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    return {
      token,
      user: {
        user_id: user.id,
        name: user.name,
        email: user.email,
        shop_id: user.shopId,
        role,
      },
    }
  },

  async logout(token: string) {
    const decoded = jwt.decode(token) as { exp?: number } | null
    if (!decoded?.exp) {
      throw new AppError(Messages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED)
    }

    const tokenHash = hashToken(token)
    const expiresAt = new Date(decoded.exp * 1000)

    await prisma.blacklistedToken.upsert({
      where: { tokenHash },
      update: { expiresAt },
      create: { tokenHash, expiresAt },
    })
  },

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = hashToken(token)
    const entry = await prisma.blacklistedToken.findUnique({
      where: { tokenHash },
    })
    return !!entry
  },

  /**
   * Generates a password reset token and sends a reset email.
   * Used by the "Forgot Password" flow on the login page.
   */
  async forgotPassword(data: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (!user) {
      // Return silently to prevent email enumeration attacks
      return
    }

    const resetToken = jwt.sign({ userId: user.id, type: 'password_reset' }, JWT_SECRET, {
      expiresIn: '8h',
    })

    await emailService.sendPasswordResetEmail(user.email, resetToken)
  },

  /**
   * Verifies a reset token and updates the user's password.
   * Shared by both "Account Setup" and "Forgot Password" flows.
   */
  async resetPassword(data: ResetPasswordInput) {
    // 1. Check if token is already used (blacklisted)
    const isBlacklisted = await this.isTokenBlacklisted(data.token)
    if (isBlacklisted) {
      throw new AppError(Messages.INVALID_RESET_TOKEN, HttpStatus.BAD_REQUEST)
    }

    let decoded: { userId: number; type: string; exp: number }

    try {
      decoded = jwt.verify(data.token, JWT_SECRET) as {
        userId: number
        type: string
        exp: number
      }
    } catch {
      throw new AppError(Messages.INVALID_RESET_TOKEN, HttpStatus.BAD_REQUEST)
    }

    if (decoded.type !== 'password_reset') {
      throw new AppError(Messages.INVALID_RESET_TOKEN, HttpStatus.BAD_REQUEST)
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    })

    if (!user) {
      throw new AppError(Messages.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10)

    // 2. Perform update and blacklist in a transaction
    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: decoded.userId },
        data: { password: hashedPassword },
      })

      const tokenHash = hashToken(data.token)
      const expiresAt = new Date(decoded.exp * 1000)

      await tx.blacklistedToken.upsert({
        where: { tokenHash },
        update: { expiresAt },
        create: { tokenHash, expiresAt },
      })
    })
  },
}
