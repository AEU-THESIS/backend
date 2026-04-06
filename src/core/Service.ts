/**
 * Core Service Dependencies
 * Import this into every service to avoid redundant boilerplate imports.
 */
import prisma from "../config/database";
import { AppError } from "../utils/appError";
import { HttpStatus } from "../constants/httpStatus";
import { Messages } from "../constants/messages";

export { prisma, AppError, HttpStatus, Messages };
