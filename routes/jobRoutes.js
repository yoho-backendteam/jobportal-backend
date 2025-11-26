import express from "express";
import {
    createJob,
    getJobs,
    getJobById,
} from "../controllers/jobController.js";
import { authMiddleware, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, authorizeRoles("hr"), createJob);
router.get("/", getJobs);
router.get("/:id", getJobById);

export default router;
