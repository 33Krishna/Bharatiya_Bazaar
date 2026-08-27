import express from "express";
import * as authController from "../controllers/authController";
import validate from "../middleware/validateMiddleware";
import * as schemas from "../validations/schemas";
import rateLimit from "express-rate-limit";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many login attempts" } }
});

router.get("/validate-referral", authController.validateReferral);
router.post("/register", validate(schemas.registerSchema), authController.register);
router.post("/login", authLimiter, validate(schemas.loginSchema), authController.login);
router.post("/admin/login", authLimiter, validate(schemas.adminLoginSchema), authController.adminLogin);

export default router;
