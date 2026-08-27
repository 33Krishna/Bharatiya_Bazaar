import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { connectDB } from "./config/db";

// Load Environment
dotenv.config();

// Fail-fast JWT Check
if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined.");
  process.exit(1);
}

// Connect to MongoDB
connectDB();

// Route imports
import authRoutes from "./routes/authRoutes";
import memberRoutes from "./routes/memberRoutes";
import walletRoutes from "./routes/walletRoutes";
import withdrawalRoutes from "./routes/withdrawalRoutes";
import vendorRoutes from "./routes/vendorRoutes";
import adminRoutes from "./routes/adminRoutes";
import setuKoshRoutes from "./routes/setuKoshRoutes";
import healthRoutes from "./routes/healthRoutes";
import idCardRoutes from "./routes/idCardRoutes";

// Middleware
import errorHandler from "./middleware/errorMiddleware";
import authMiddleware from "./middleware/authMiddleware";

const app = express();

// Global Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"],
        "script-src-attr": ["'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"]
      }
    }
  })
);

const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : ["http://localhost:3000", "http://localhost:4000", "http://localhost:5173"];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// Serve Static Files (Frontend assets, etc.)
app.use(express.static(path.join(__dirname, "../public")));

// Fallback HTML router
app.get("/", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../public", "bharatiya-bazaar-v2.html"));
});

// Mount API routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/setu-kosh", setuKoshRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/id-cards", authMiddleware as any, idCardRoutes);

// Background Jobs & Startup Seeds
import "./jobs/scheduler";
import { seedSettingsAndSuperAdmin } from "./lib/seedSettings";
seedSettingsAndSuperAdmin()
  .then(() => console.log("[INIT] Startup seeding completed successfully."))
  .catch(err => console.error("[INIT] Error during settings seed:", err));

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app; // Export for testing
