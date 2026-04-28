import { Request, Response, catchAsync, sendSuccess, Messages } from '../core/Controller'
import { loginSchema } from '../validations/authValidation'
import { authService } from '../services/authService'

export const authController = {
  login: catchAsync(async (req: Request, res: Response) => {
    const body = loginSchema.parse(req.body)
    const result = await authService.login(body)

    return sendSuccess(res, result, 'Login successful')
  }),

  logout: catchAsync(async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      await authService.logout(token)
    }

    return sendSuccess(res, null, Messages.LOGGED_OUT)
  }),
}
