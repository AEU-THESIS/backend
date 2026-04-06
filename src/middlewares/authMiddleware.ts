import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/appError";
import { HttpStatus } from "../constants/httpStatus";
import { Messages } from "../constants/messages";
import prisma from "../config/database";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(Messages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret",
    ) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new AppError(Messages.USER_NOT_FOUND, HttpStatus.UNAUTHORIZED);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error); // falls through to errorHandler
  }
};
