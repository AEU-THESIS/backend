import { Router } from "express";
import { shopController } from "../controllers/shopController";
import { authenticate } from "../middlewares/authMiddleware";
import { requireRoles } from "../middlewares/roleMiddleware";

const router = Router();

// Protect shop routes securely
router.use(authenticate);

// Only Admins can create shops
router.post("/", requireRoles(["Admin"]), shopController.create);
router.get("/", shopController.getAll);

export default router;
