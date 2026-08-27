import express from "express";
import * as healthController from "../controllers/healthController";

const router = express.Router();

router.get("/", healthController.checkHealth);
router.get("/db", healthController.checkDbHealth);

export default router;
