import { prisma, AppError, HttpStatus, Messages } from "../core/Service";
import type { CreateUserInput } from "../validations/userValidation";
import { emailService } from "./emailService";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const userService = {
  async createUserByAdmin(data: CreateUserInput) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new AppError(Messages.USER_ALREADY_EXISTS, HttpStatus.BAD_REQUEST);
    }

    const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
    if (!shop) {
      throw new AppError(Messages.SHOP_NOT_FOUND, HttpStatus.BAD_REQUEST);
    }

    // Generate a temporary unguessable password
    const randomPassword = Math.random().toString(36).slice(-12);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const user = await prisma.user.create({
      data: {
        shopId: data.shopId,
        name: data.name,
        email: data.email,
        password: hashedPassword,
      },
    });

    // Generate 24-hour single-use reset token
    const resetToken = jwt.sign(
      { userId: user.id, type: "password_reset" },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: "24h" },
    );

    await emailService.sendPasswordResetEmail(user.email, resetToken);

    return user;
  },
};
