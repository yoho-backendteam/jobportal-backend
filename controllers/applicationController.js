import Application from "../model/Application.js";
import Job from "../model/Job.js";
import User from "../model/User.js";
import {
    createApplicationValidation,
    updateApplicationValidation,
    updateApplicationStatusValidation,
    applicationQueryValidation
} from "../validations/applicationValidation.js";

// Create Application
export const createApplication = async (req, res) => {
    try {
        const { error } = createApplicationValidation.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { job: jobId, additionalDocuments } = req.body;
        const userId = req.user._id;

        // Check if job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: "Job not found"
            });
        }

        // Check if user has already applied for this job
        const existingApplication = await Application.findOne({
            job: jobId,
            user: userId
        });

        if (existingApplication) {
            return res.status(400).json({
                success: false,
                message: "You have already applied for this job"
            });
        }

        // Create application
        const application = await Application.create({
            job: jobId,
            user: userId,
            additionalDocuments
        });

        // Populate application details
        await application.populate([
            { path: 'job', select: 'title department location employmentType workingMode' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        // Increment job applicants count
        await Job.findByIdAndUpdate(jobId, { $inc: { applicantsCount: 1 } });

        res.status(201).json({
            success: true,
            message: "Application submitted successfully",
            data: application
        });
    } catch (error) {
        console.error("Create application error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get User's Applications
export const getMyApplications = async (req, res) => {
    try {
        const { error } = applicationQueryValidation.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { status, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;
        const userId = req.user._id;

        const filter = { user: userId };
        if (status) filter.status = status;

        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;

        const applications = await Application.find(filter)
            .populate({
                path: 'job',
                select: 'title department location employmentType workingMode salaryRange experienceRequired applicantsCount'
            })
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Application.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: "Applications retrieved successfully",
            data: applications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalApplications: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error("Get my applications error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Application by ID
export const getApplicationById = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate({
                path: 'job',
                select: 'title department location employmentType workingMode salaryRange experienceRequired jobDescription keyResponsibilities qualifications vacancyCount applicantsCount'
            })
            .populate({
                path: 'user',
                select: 'fullName email phoneNumber dateOfBirth gender address city state pincode highestEducation institution graduationYear percentage specialization totalExperience keySkills resume'
            });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        // Check if user has permission to view this application
        if (req.user.role === "candidate" && application.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only view your own applications."
            });
        }

        res.status(200).json({
            success: true,
            message: "Application retrieved successfully",
            data: application
        });
    } catch (error) {
        console.error("Get application by ID error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update Application (Candidate can update additional documents)
export const updateApplication = async (req, res) => {
    try {
        const { error } = updateApplicationValidation.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const application = await Application.findById(req.params.id);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        // Check permissions
        if (req.user.role === "candidate") {
            if (application.user.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. You can only update your own applications."
                });
            }
            // Candidates can only update additional documents
            const allowedFields = ["additionalDocuments"];
            Object.keys(req.body).forEach(key => {
                if (!allowedFields.includes(key)) {
                    delete req.body[key];
                }
            });
        }

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location employmentType workingMode' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        res.status(200).json({
            success: true,
            message: "Application updated successfully",
            data: updatedApplication
        });
    } catch (error) {
        console.error("Update application error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update Application Status (HR only)
export const updateApplicationStatus = async (req, res) => {
    try {
        const { error } = updateApplicationStatusValidation.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const application = await Application.findById(req.params.id);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        const updateData = { status: req.body.status };

        if (req.body.interviewDate) {
            updateData.interviewDate = req.body.interviewDate;
        }

        if (req.body.rejectionReason) {
            updateData.rejectionReason = req.body.rejectionReason;
        }

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        res.status(200).json({
            success: true,
            message: `Application status updated to ${req.body.status}`,
            data: updatedApplication
        });
    } catch (error) {
        console.error("Update application status error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Applications for a Job (HR only)
export const getJobApplications = async (req, res) => {
    try {
        const { error } = applicationQueryValidation.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { status, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;
        const jobId = req.params.jobId;

        // Check if job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: "Job not found"
            });
        }

        const filter = { job: jobId };
        if (status) filter.status = status;

        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;

        const applications = await Application.find(filter)
            .populate({
                path: 'user',
                select: 'fullName email phoneNumber highestEducation institution totalExperience keySkills resume'
            })
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Application.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: "Job applications retrieved successfully",
            data: applications,
            job: {
                title: job.title,
                department: job.department,
                location: job.location
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalApplications: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error("Get job applications error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get All Applications (HR only)
export const getAllApplications = async (req, res) => {
    try {
        const { error } = applicationQueryValidation.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { status, job, user, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (job) filter.job = job;
        if (user) filter.user = user;

        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;

        const applications = await Application.find(filter)
            .populate({
                path: 'job',
                select: 'title department location employmentType'
            })
            .populate({
                path: 'user',
                select: 'fullName email phoneNumber highestEducation totalExperience'
            })
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Application.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: "All applications retrieved successfully",
            data: applications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalApplications: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error("Get all applications error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete/Withdraw Application
export const deleteApplication = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id);

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        // Check if user owns this application or is HR
        if (req.user.role === "candidate" && application.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only delete your own applications."
            });
        }

        await Application.findByIdAndDelete(req.params.id);

        // Decrement job applicants count
        await Job.findByIdAndUpdate(application.job, { $inc: { applicantsCount: -1 } });

        res.status(200).json({
            success: true,
            message: "Application deleted successfully"
        });
    } catch (error) {
        console.error("Delete application error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Application Statistics
export const getApplicationStats = async (req, res) => {
    try {
        let filter = {};

        // If candidate, only show their stats
        if (req.user.role === "candidate") {
            filter.user = req.user._id;
        }

        const stats = await Application.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const total = await Application.countDocuments(filter);

        const statistics = {
            total,
            applied: 0,
            reviewed: 0,
            shortlisted: 0,
            "interview scheduled": 0,
            "interview selected": 0,
            "offer sent": 0,
            "offer accepted": 0,
            "offer rejected": 0,
            rejected: 0,
            "doc verification pending": 0,
            "doc verified": 0,
            onboarded: 0
        };

        stats.forEach(stat => {
            statistics[stat._id] = stat.count;
        });

        res.status(200).json({
            success: true,
            message: "Application statistics retrieved successfully",
            data: statistics
        });
    } catch (error) {
        console.error("Get application stats error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};