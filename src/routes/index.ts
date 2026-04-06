import { Router } from "express";
import authRoutes from "./authRoutes";
import shopRoutes from "./shopRoutes";
import userRoutes from "./userRoutes";

const router = Router();

// Combine all domain routes here
router.use("/auth", authRoutes);
router.use("/shops", shopRoutes);
router.use("/users", userRoutes);

export default router;
