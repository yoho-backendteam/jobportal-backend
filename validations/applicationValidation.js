import Joi from "joi";

const statusEnum = [
    "applied", "reviewed", "shortlisted", "interview scheduled",
    "interview selected", "offer sent", "offer accepted",
    "offer rejected", "rejected", "doc verification pending",
    "doc verified", "onboarded"
];

export const createApplicationValidation = Joi.object({
    job: Joi.string().hex().length(24).required().messages({
        "string.hex": "Job ID must be a valid MongoDB ID",
        "string.length": "Job ID must be 24 characters long",
        "any.required": "Job ID is required"
    }),
    additionalDocuments: Joi.array().items(
        Joi.object({
            name: Joi.string().required().messages({
                "string.empty": "Document name is required"
            }),
            file: Joi.string().required().messages({
                "string.empty": "Document file is required"
            })
        })
    ).optional()
});

export const updateApplicationValidation = Joi.object({
    status: Joi.string().valid(...statusEnum).optional().messages({
        "any.only": `Status must be one of: ${statusEnum.join(", ")}`
    }),
    interviewDate: Joi.date().optional().messages({
        "date.base": "Interview date must be a valid date"
    }),
    rejectionReason: Joi.string().allow("").optional(),
    additionalDocuments: Joi.array().items(
        Joi.object({
            name: Joi.string().required(),
            file: Joi.string().required()
        })
    ).optional(),
    isActive: Joi.boolean().optional()
});

export const updateApplicationStatusValidation = Joi.object({
    status: Joi.string().valid(...statusEnum).required().messages({
        "any.only": `Status must be one of: ${statusEnum.join(", ")}`,
        "any.required": "Status is required"
    }),
    interviewDate: Joi.when('status', {
        is: 'interview scheduled',
        then: Joi.date().required().messages({
            "date.base": "Interview date is required when status is 'interview scheduled'",
            "any.required": "Interview date is required when status is 'interview scheduled'"
        }),
        otherwise: Joi.date().optional()
    }),
    rejectionReason: Joi.when('status', {
        is: Joi.valid('rejected', 'offer rejected'),
        then: Joi.string().min(5).required().messages({
            "string.min": "Rejection reason must be at least 5 characters long",
            "any.required": "Rejection reason is required for rejected status"
        }),
        otherwise: Joi.string().allow("").optional()
    })
});

export const applicationQueryValidation = Joi.object({
    status: Joi.string().valid(...statusEnum).optional(),
    job: Joi.string().hex().length(24).optional(),
    user: Joi.string().hex().length(24).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid("createdAt", "updatedAt", "interviewDate").default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc")
});