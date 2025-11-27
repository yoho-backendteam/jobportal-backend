import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/authMiddleware.js";
import { getDashboardStats, getAdvancedAnalytics } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", authMiddleware, getDashboardStats);
router.get("/analytics", authMiddleware, authorizeRoles("hr"), getAdvancedAnalytics);

export default router;