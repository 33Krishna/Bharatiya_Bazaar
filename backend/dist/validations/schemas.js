"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingUpdateSchema = exports.vendorRegisterSchema = exports.vendorSaleSchema = exports.withdrawalRequestSchema = exports.kycSchema = exports.adminLoginSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2, "Name is required"),
        mobile: zod_1.z.string().length(10, "Mobile must be 10 digits").regex(/^\d+$/),
        email: zod_1.z.string().email("Invalid email format").optional(),
        address: zod_1.z.string().optional(),
        pinCode: zod_1.z.string().optional(),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
        referralCode: zod_1.z.string().optional(),
        side: zod_1.z.enum(["LEFT", "RIGHT"]).optional()
    })
});
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        mobile: zod_1.z.string().min(3, "Enter Member ID or Mobile"),
        password: zod_1.z.string().min(1, "Password is required")
    })
});
exports.adminLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
        password: zod_1.z.string().min(1, "Password is required")
    })
});
exports.kycSchema = zod_1.z.object({
    body: zod_1.z.object({
        panNumber: zod_1.z.string().min(10, "PAN must be 10 characters").optional(),
        panCardUrl: zod_1.z.string().url("Must be a valid URL").optional(),
        aadhaarFrontUrl: zod_1.z.string().url("Must be a valid URL").optional(),
        aadhaarBackUrl: zod_1.z.string().url("Must be a valid URL").optional()
    })
});
exports.withdrawalRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        idCardId: zod_1.z.string().optional(),
        method: zod_1.z.enum(["BANK", "UPI", "WALLET", "MEMBER_WALLET", "VOUCHER_CONVERSION"]).optional(),
        amountPaise: zod_1.z.number().positive("Amount must be positive"),
        paymentDetails: zod_1.z.any().optional(),
        idempotencyKey: zod_1.z.string().optional()
    })
});
exports.vendorSaleSchema = zod_1.z.object({
    body: zod_1.z.object({
        memberId: zod_1.z.string().optional(),
        buyerCode: zod_1.z.string().optional(),
        cardNumber: zod_1.z.string().optional(),
        memberCode: zod_1.z.string().optional(),
        idCardId: zod_1.z.string().optional(),
        amountPaise: zod_1.z.number().positive("Amount must be positive"),
        idempotencyKey: zod_1.z.string().optional()
    })
});
exports.vendorRegisterSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2, "Owner name is required"),
        businessName: zod_1.z.string().min(2, "Business name is required"),
        mobile: zod_1.z.string().length(10, "Mobile must be 10 digits").regex(/^\d+$/),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
        category: zod_1.z.string().optional().default("GENERAL"),
        entityType: zod_1.z.enum(["INDIVIDUAL", "COMPANY"]).optional().default("INDIVIDUAL"),
        panNumber: zod_1.z.string().min(10, "PAN must be 10 characters").optional(),
        gstin: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        pinCode: zod_1.z.string().optional(),
        payoutMethod: zod_1.z.enum(["WALLET", "BANK"]).optional().default("BANK"),
        referrerCode: zod_1.z.string().optional(),
        referrerMemberCode: zod_1.z.string().optional()
    })
});
exports.settingUpdateSchema = zod_1.z.object({
    body: zod_1.z.object({
        value: zod_1.z.string().min(1, "Value is required"),
        description: zod_1.z.string().optional()
    })
});
