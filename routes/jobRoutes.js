import express from "express";
import {
    createJob,
    getJobs,
    getJobById,
    applyJob
} from "../controllers/jobController.js";

const router = express.Router();

router.post("/", createJob);
router.get("/", getJobs);
router.get("/:id", getJobById);
router.put("/apply/:id", applyJob);

export default router;
