import { Response } from "express";
import { HttpStatus } from "../constants/httpStatus";
import { Messages } from "../constants/messages";

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = Messages.SUCCESS,
  statusCode: number = HttpStatus.OK,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string = Messages.INTERNAL_ERROR,
  statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
  errors?: any,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};
