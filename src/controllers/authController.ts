import { Request, Response, catchAsync, sendSuccess, Messages } from '../core/Controller'
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations/authValidation'
import { authService } from '../services/authService'

export const authController = {
  login: catchAsync(async (req: Request, res: Response) => {
    const body = loginSchema.parse(req.body)
    const result = await authService.login(body)

    return sendSuccess(res, result, 'Login successful')
  }),

  logout: catchAsync(async (req: Request, res: Response) => {
    const token = req.headers.authorization!.split(' ')[1]
    await authService.logout(token)
    return sendSuccess(res, null, Messages.LOGGED_OUT)
  }),

  me: catchAsync(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!.user_id)
    return sendSuccess(res, user)
  }),

  forgotPassword: catchAsync(async (req: Request, res: Response) => {
    const body = forgotPasswordSchema.parse(req.body)
    await authService.forgotPassword(body)
    return sendSuccess(res, null, Messages.RESET_LINK_SENT)
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    const body = resetPasswordSchema.parse({
      ...req.body,
      token: req.params.token,
    })
    await authService.resetPassword(body)
    return sendSuccess(res, null, Messages.PASSWORD_RESET_SUCCESS)
  }),
}
