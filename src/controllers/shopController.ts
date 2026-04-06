import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from "../core/Controller";
import { createShopSchema } from "../validations/shopValidation";
import { shopService } from "../services/shopService";

export const shopController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const body = createShopSchema.parse(req.body);
    const shop = await shopService.create(body);
    return sendSuccess(res, shop, Messages.CREATED, HttpStatus.CREATED);
  }),

  getAll: catchAsync(async (req: Request, res: Response) => {
    const shops = await shopService.getAll();
    return sendSuccess(res, shops);
  }),
};
