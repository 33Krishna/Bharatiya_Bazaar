import express from "express";
import * as setuKoshController from "../controllers/setuKoshController";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

router.use(authMiddleware as any);

router.post("/purchase", setuKoshController.purchase);
router.get("/counter", setuKoshController.getCounter);
router.get("/tree", setuKoshController.getTree);

export default router;
