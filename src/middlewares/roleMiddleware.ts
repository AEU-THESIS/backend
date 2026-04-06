import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError";
import { HttpStatus } from "../constants/httpStatus";
import { Messages } from "../constants/messages";

export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(Messages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED));
    }

    const userRoles = req.user.roles?.map((r: any) => r.role.name) || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return next(new AppError(Messages.FORBIDDEN, HttpStatus.FORBIDDEN));
    }

    next();
  };
};
