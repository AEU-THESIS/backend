import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/appError";
import { sendError } from "../utils/apiResponse";
import { HttpStatus } from "../constants/httpStatus";
import { Messages } from "../constants/messages";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // Only log unexpected server errors to the console
  const isExpectedError =
    err instanceof AppError ||
    err instanceof ZodError ||
    err.name === "JsonWebTokenError" ||
    err.name === "TokenExpiredError";

  if (!isExpectedError) {
    console.error("🔥 Server Error:", err);
  }

  // 1. Handle Zod Validation Errors
  if (err instanceof ZodError) {
    return sendError(
      res,
      Messages.VALIDATION_ERROR,
      HttpStatus.BAD_REQUEST,
      err.issues,
    );
  }

  // 2. Handle Custom App Errors
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  // 3. Handle Prisma Errors (e.g., unique constraint violations)
  if (err.code === "P2002") {
    return sendError(
      res,
      "A unique constraint would be violated on this record.",
      HttpStatus.BAD_REQUEST,
    );
  }

  // 4. Handle JWT Errors
  if (err.name === "JsonWebTokenError") {
    return sendError(
      res,
      "Invalid token. Please log in again.",
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (err.name === "TokenExpiredError") {
    return sendError(
      res,
      "Your token has expired. Please log in again.",
      HttpStatus.UNAUTHORIZED,
    );
  }

  // 5. Fallback unhandled server errors
  return sendError(
    res,
    Messages.INTERNAL_ERROR,
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
};
