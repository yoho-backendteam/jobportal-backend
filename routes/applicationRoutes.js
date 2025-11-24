import express from "express";
import {
    createApplication,
    getMyApplications,
    getApplicationById,
    updateApplication,
    updateApplicationStatus,
    getJobApplications,
    getAllApplications,
    deleteApplication,
    getApplicationStats
} from "../controllers/applicationController.js";
import { authMiddleware, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Candidate routes
router.post("/", createApplication);
router.get("/my-applications", getMyApplications);
router.get("/stats", getApplicationStats);
router.get("/:id", getApplicationById);
router.put("/:id", updateApplication);
router.delete("/:id", deleteApplication);

// HR only routes
router.get("/", authorizeRoles("hr"), getAllApplications);
router.get("/job/:jobId", authorizeRoles("hr"), getJobApplications);
router.put("/:id/status", authorizeRoles("hr"), updateApplicationStatus);

export default router;