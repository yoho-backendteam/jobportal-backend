import Application from "../model/Application.js";
import Job from "../model/Job.js";
import {
    createApplicationValidation,
    updateApplicationValidation,
    updateApplicationStatusValidation,
    applicationQueryValidation,
    interviewValidation,
    offerValidation,
    offerStatusValidation,
    documentUploadValidation,
    documentVerificationValidation,
    documentUpdateValidation
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

        // Check if job is active
        if (!job.isActive) {
            return res.status(400).json({
                success: false,
                message: "This job is no longer accepting applications"
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

        // TODO: Send notification to HR

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
            .populate({ path: 'user', select: 'fullName email phoneNumber' })
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

        const { status, rejectionReason } = req.body;

        // Validate status transition
        const validTransitions = {
            "applied": ["reviewed", "rejected"],
            "reviewed": ["shortlisted", "rejected"],
            "shortlisted": ["interview scheduled", "rejected"],
            "interview scheduled": ["interview selected", "interview rejected", "rejected"],
            "interview selected": ["offer sent", "rejected"],
            "interview rejected": ["rejected"],
            "offer sent": ["offer accepted", "offer rejected", "rejected"],
            "offer accepted": ["doc verification pending", "rejected"],
            "offer rejected": ["rejected"],
            "doc verification pending": ["doc verified", "rejected"],
            "doc verified": ["onboarded", "rejected"]
        };

        if (!validTransitions[application.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition from ${application.status} to ${status}`
            });
        }

        const updateData = { status };

        if (rejectionReason) {
            updateData.rejectionReason = rejectionReason;
            if (status === "rejected" || status === "offer rejected" || status === "interview rejected") {
                updateData.isActive = false;
            }
        }

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        // TODO: Send status update notification to candidate

        res.status(200).json({
            success: true,
            message: `Application status updated to ${status}`,
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

// Schedule Interview (HR only)
export const scheduleInterview = async (req, res) => {
    try {
        const { error } = interviewValidation.validate(req.body);
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

        // Check if application is in shortlisted status
        if (application.status !== "shortlisted") {
            return res.status(400).json({
                success: false,
                message: "Interview can only be scheduled for shortlisted applications"
            });
        }

        const updateData = {
            status: "interview scheduled",
            interviewDetails: req.body
        };

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        // TODO: Send interview notification email to candidate

        res.status(200).json({
            success: true,
            message: "Interview scheduled successfully",
            data: updatedApplication
        });
    } catch (error) {
        console.error("Schedule interview error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Send Offer (HR only)
export const sendOffer = async (req, res) => {
    try {
        const { error } = offerValidation.validate(req.body);
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

        // Check if application is in interview selected status
        if (application.status !== "interview selected") {
            return res.status(400).json({
                success: false,
                message: "Offer can only be sent for selected candidates"
            });
        }

        const updateData = {
            status: "offer sent",
            offerDetails: {
                ...req.body,
                sentDate: new Date()
            }
        };

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        // TODO: Send offer email to candidate

        res.status(200).json({
            success: true,
            message: "Offer sent successfully",
            data: updatedApplication
        });
    } catch (error) {
        console.error("Send offer error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update Offer Status (Candidate)
export const updateOfferStatus = async (req, res) => {
    try {
        const { error } = offerStatusValidation.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { status } = req.body;
        const application = await Application.findById(req.params.id);

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        // Check permissions
        if (application.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only update your own applications."
            });
        }

        // Check if application is in offer sent status
        if (application.status !== "offer sent") {
            return res.status(400).json({
                success: false,
                message: "Offer status can only be updated when offer is sent"
            });
        }

        let updateData = { status };

        if (status === "offer rejected") {
            updateData.isActive = false;
        } else if (status === "offer accepted") {
            updateData.status = "doc verification pending";
        }

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        // TODO: Send notification to HR about offer status update

        res.status(200).json({
            success: true,
            message: `Offer ${status} successfully`,
            data: updatedApplication
        });
    } catch (error) {
        console.error("Update offer status error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Upload Documents (Candidate)
export const uploadDocuments = async (req, res) => {
    try {
        const { error } = documentUploadValidation.validate(req.body);
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
        if (application.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only update your own applications."
            });
        }

        // Check if application is in doc verification pending status
        if (application.status !== "doc verification pending") {
            return res.status(400).json({
                success: false,
                message: "Documents can only be uploaded when document verification is pending"
            });
        }

        const { documents } = req.body;

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            {
                $push: { documents: { $each: documents } }
            },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        res.status(200).json({
            success: true,
            message: "Documents uploaded successfully",
            data: updatedApplication
        });
    } catch (error) {
        console.error("Upload documents error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update Document (Candidate)
export const updateDocument = async (req, res) => {
    try {
        const { error } = documentUpdateValidation.validate(req.body);
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
        if (application.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only update your own applications."
            });
        }

        const { documentId, file, name } = req.body;

        // Find the document
        const document = application.documents.id(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // Update document
        document.file = file;
        document.name = name || document.name;
        document.status = "pending";
        document.rejectionReason = "";
        document.uploadedAt = new Date();

        await application.save();

        const updatedApplication = await Application.findById(req.params.id)
            .populate([
                { path: 'job', select: 'title department location' },
                { path: 'user', select: 'fullName email phoneNumber' }
            ]);

        res.status(200).json({
            success: true,
            message: "Document updated successfully",
            data: updatedApplication
        });
    } catch (error) {
        console.error("Update document error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Verify Document (HR only)
export const verifyDocument = async (req, res) => {
    try {
        const { error } = documentVerificationValidation.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { documentId, status, rejectionReason } = req.body;
        const application = await Application.findById(req.params.id);

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        // Find the document
        const document = application.documents.id(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // Update document status
        document.status = status;
        document.verifiedAt = new Date();

        if (status === "rejected" && rejectionReason) {
            document.rejectionReason = rejectionReason;
        }

        await application.save();

        // Check if all documents are approved
        const allApproved = application.documents.every(doc => doc.status === "approved");

        if (allApproved && application.documents.length > 0) {
            application.status = "doc verified";
            await application.save();
        }

        const updatedApplication = await Application.findById(req.params.id)
            .populate([
                { path: 'job', select: 'title department location' },
                { path: 'user', select: 'fullName email phoneNumber' }
            ]);

        res.status(200).json({
            success: true,
            message: `Document ${status} successfully`,
            data: updatedApplication
        });
    } catch (error) {
        console.error("Verify document error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Onboard Candidate (HR only)
export const onboardCandidate = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id);

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        // Check if application is in doc verified status
        if (application.status !== "doc verified") {
            return res.status(400).json({
                success: false,
                message: "Candidate can only be onboarded after document verification"
            });
        }

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { status: "onboarded" },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location' },
            { path: 'user', select: 'fullName email phoneNumber' }
        ]);

        // TODO: Create employee record and send onboarding email

        res.status(200).json({
            success: true,
            message: "Candidate onboarded successfully",
            data: updatedApplication
        });
    } catch (error) {
        console.error("Onboard candidate error:", error);
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
            "interview rejected": 0,
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

// Reschedule Interview (HR only)
export const rescheduleInterview = async (req, res) => {
    try {
        const { error } = interviewValidation.validate(req.body);
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

        // Check if application is in interview scheduled or interview rescheduled status
        if (!["interview scheduled", "interview rescheduled"].includes(application.status)) {
            return res.status(400).json({
                success: false,
                message: "Interview can only be rescheduled for scheduled interviews"
            });
        }

        // Save previous interview details to history
        const rescheduleRecord = {
            previousDate: application.interviewDetails.date,
            previousTime: application.interviewDetails.time,
            previousMode: application.interviewDetails.mode,
            previousVenue: application.interviewDetails.venue,
            previousMeetingLink: application.interviewDetails.meetingLink,
            rescheduledBy: req.user._id,
            reason: req.body.reason || "Rescheduled by HR"
        };

        // Update interview details
        const updateData = {
            status: "interview rescheduled",
            interviewDetails: {
                ...application.interviewDetails.toObject(),
                ...req.body,
                scheduledBy: req.user._id,
                scheduledAt: new Date()
            }
        };

        // Add to reschedule history
        if (!application.interviewDetails.rescheduleHistory) {
            updateData.interviewDetails.rescheduleHistory = [rescheduleRecord];
        } else {
            updateData.interviewDetails.rescheduleHistory.push(rescheduleRecord);
        }

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate([
            { path: 'job', select: 'title department location' },
            { path: 'user', select: 'fullName email phoneNumber' },
            { path: 'interviewDetails.scheduledBy', select: 'fullName email' },
            { path: 'interviewDetails.rescheduleHistory.rescheduledBy', select: 'fullName email' }
        ]);

        // TODO: Send interview reschedule notification email to candidate

        res.status(200).json({
            success: true,
            message: "Interview rescheduled successfully",
            data: updatedApplication
        });
    } catch (error) {
        console.error("Reschedule interview error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Interview Reschedule History (HR & Candidate)
export const getInterviewRescheduleHistory = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate({
                path: 'interviewDetails.rescheduleHistory.rescheduledBy',
                select: 'fullName email role'
            })
            .select('interviewDetails.rescheduleHistory status');

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        // Check permissions
        if (req.user.role === "candidate" && application.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only view your own applications."
            });
        }

        res.status(200).json({
            success: true,
            message: "Reschedule history retrieved successfully",
            data: {
                rescheduleHistory: application.interviewDetails.rescheduleHistory || [],
                currentStatus: application.status
            }
        });
    } catch (error) {
        console.error("Get reschedule history error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};