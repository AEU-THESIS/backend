import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from "../core/Controller";
import { createUserSchema } from "../validations/userValidation";
import { userService } from "../services/userService";

export const userController = {
  createByAdmin: catchAsync(async (req: Request, res: Response) => {
    const body = createUserSchema.parse(req.body);
    const user = await userService.createUserByAdmin(body);
    return sendSuccess(res, user, Messages.CREATED, HttpStatus.CREATED);
  }),
};
