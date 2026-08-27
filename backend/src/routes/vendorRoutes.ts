import express from "express";
import * as vendorController from "../controllers/vendorController";
import vendorAuthMiddleware from "../middleware/vendorAuthMiddleware";
import validate from "../middleware/validateMiddleware";
import * as schemas from "../validations/schemas";

const router = express.Router();

// Public vendor registration & login
router.post("/register", validate(schemas.vendorRegisterSchema), vendorController.register);
router.post("/login", validate(schemas.loginSchema), vendorController.login);

// Protected vendor routes
router.get("/me", vendorAuthMiddleware as any, vendorController.getProfile);
router.post("/sale", vendorAuthMiddleware as any, validate(schemas.vendorSaleSchema), vendorController.recordSale);
router.get("/settlements", vendorAuthMiddleware as any, vendorController.getSettlements);
router.post("/settlement/early", vendorAuthMiddleware as any, vendorController.requestEarlySettlement);

export default router;
