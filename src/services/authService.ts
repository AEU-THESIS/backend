import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginInput } from '../validations/authValidation';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export const authService = {
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    const roles = user.roles.map((r) => r.role.name);

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        shopId: user.shopId,
        roles,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        shopId: user.shopId,
        roles,
      },
    };
  },
};
