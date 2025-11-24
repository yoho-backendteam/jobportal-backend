import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        // Basic Information
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true
        },
        password: {
            type: String,
            required: true,
            minlength: 6
        },
        role: {
            type: String,
            enum: ["hr", "candidate", "employee"],
            required: true
        },

        // Personal Details
        dateOfBirth: {
            type: Date
        },
        gender: {
            type: String,
            enum: ["Male", "Female", "Other", ""],
            default: ""
        },
        address: {
            type: String,
            default: ""
        },
        city: {
            type: String,
            default: ""
        },
        state: {
            type: String,
            default: ""
        },
        pincode: {
            type: String,
            default: ""
        },

        // Educational Details
        highestEducation: {
            type: String,
            default: ""
        },
        institution: {
            type: String,
            default: ""
        },
        graduationYear: {
            type: Number,
            default: null
        },
        percentage: {
            type: Number,
            default: null
        },
        specialization: {
            type: String,
            default: ""
        },

        // Experience and Skills
        totalExperience: {
            type: Number,
            default: 0
        },
        keySkills: [{
            type: String
        }],
        resume: {
            type: String, // base64 encoded string
            default: ""
        },

        // Account Status
        isActive: {
            type: Boolean,
            default: true
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        lastLogin: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Remove password from JSON output
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    return user;
};

export default mongoose.model("User", userSchema);