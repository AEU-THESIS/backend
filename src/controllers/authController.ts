import { Request, Response, catchAsync, sendSuccess } from "../core/Controller";
import { loginSchema } from "../validations/authValidation";
import { authService } from "../services/authService";

export const authController = {
  login: catchAsync(async (req: Request, res: Response) => {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);

    return sendSuccess(res, result, "Login successful");
  }),
};
