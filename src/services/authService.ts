import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import type { LoginInput } from '../validations/authValidation'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn']

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
}
