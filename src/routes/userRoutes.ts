import { Router } from "express";
import { userController } from "../controllers/userController";
import { authenticate } from "../middlewares/authMiddleware";
import { requireRoles } from "../middlewares/roleMiddleware";

const router = Router();

// Protect routing
router.use(authenticate);

// Admin-only route for creating secondary users
router.post("/admin", requireRoles(["Admin"]), userController.createByAdmin);

export default router;
