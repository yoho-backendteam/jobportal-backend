import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
    {
        job: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Job",
            required: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        status: {
            type: String,
            enum: [
                "applied",
                "reviewed",
                "shortlisted",
                "interview scheduled",
                "interview selected",
                "offer sent",
                "offer accepted",
                "offer rejected",
                "rejected",
                "doc verification pending",
                "doc verified",
                "onboarded"
            ],
            default: "applied"
        },
        interviewDate: {
            type: Date
        },
        rejectionReason: {
            type: String,
            default: ""
        },
        additionalDocuments: [{
            name: String,
            file: String
        }],
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Application", applicationSchema);