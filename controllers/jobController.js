import Job from "../model/Job.js";
import { jobValidation } from "../validations/jobValidation.js";

// Create Job
export const createJob = async (req, res) => {
    try {
        const { error } = jobValidation.validate(req.body);
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });

        const job = await Job.create({ ...req.body });

        res.status(201).json({ success: true, message: "Job posted successfully", data: job });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get all jobs
export const getJobs = async (req, res) => {
    try {
        const jobs = await Job.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, message: "Jobs retrieved successfully", data: jobs, count: jobs.length });
    } catch (err) {
        res.status(500).json({ succes: false, message: err.message });
    }
};

// Get single job
export const getJobById = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ succes: false, message: "Job not found" });
        res.status(200).json({ success: true, message: "Job retrieved successfully", data: job });
    } catch (err) {
        res.status(500).json({ succes: false, message: err.message });
    }
};

