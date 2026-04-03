import { Request, Response } from "express";
import { loginSchema } from "../validations/authValidation";
import { authService } from "../services/authService";

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const body = loginSchema.parse(req.body);
      const result = await authService.login(body);

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error: any) {
      // Zod validation error
      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.errors,
        });
      }

      // Known service error
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      // Unknown error
      console.error("Login error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};
