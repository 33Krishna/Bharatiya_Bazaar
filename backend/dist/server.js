"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
// Load Environment
dotenv_1.default.config();
// Fail-fast JWT Check
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined.");
    process.exit(1);
}
// Connect to MongoDB
(0, db_1.connectDB)();
// Route imports
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const memberRoutes_1 = __importDefault(require("./routes/memberRoutes"));
const walletRoutes_1 = __importDefault(require("./routes/walletRoutes"));
const withdrawalRoutes_1 = __importDefault(require("./routes/withdrawalRoutes"));
const vendorRoutes_1 = __importDefault(require("./routes/vendorRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const setuKoshRoutes_1 = __importDefault(require("./routes/setuKoshRoutes"));
const healthRoutes_1 = __importDefault(require("./routes/healthRoutes"));
const idCardRoutes_1 = __importDefault(require("./routes/idCardRoutes"));
// Middleware
const errorMiddleware_1 = __importDefault(require("./middleware/errorMiddleware"));
const authMiddleware_1 = __importDefault(require("./middleware/authMiddleware"));
const app = (0, express_1.default)();
// Global Security Headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            ...helmet_1.default.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"],
            "script-src-attr": ["'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "data:"]
        }
    }
}));
const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : ["http://localhost:3000", "http://localhost:4000", "http://localhost:5173"];
app.use((0, cors_1.default)({ origin: allowedOrigins }));
app.use(express_1.default.json({ limit: "100kb" }));
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);
// Serve Static Files (Frontend assets, etc.)
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
// Fallback HTML router
app.get("/", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public", "bharatiya-bazaar-v2.html"));
});
// Mount API routes
app.use("/api/health", healthRoutes_1.default);
app.use("/api/auth", authRoutes_1.default);
app.use("/api/members", memberRoutes_1.default);
app.use("/api/wallet", walletRoutes_1.default);
app.use("/api/wallets", walletRoutes_1.default);
app.use("/api/withdrawals", withdrawalRoutes_1.default);
app.use("/api/vendors", vendorRoutes_1.default);
app.use("/api/setu-kosh", setuKoshRoutes_1.default);
app.use("/api/admin", adminRoutes_1.default);
app.use("/api/id-cards", authMiddleware_1.default, idCardRoutes_1.default);
// Background Jobs & Startup Seeds
require("./jobs/scheduler");
const seedSettings_1 = require("./lib/seedSettings");
(0, seedSettings_1.seedSettingsAndSuperAdmin)()
    .then(() => console.log("[INIT] Startup seeding completed successfully."))
    .catch(err => console.error("[INIT] Error during settings seed:", err));
// Global Error Handler
app.use(errorMiddleware_1.default);
const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
exports.default = app; // Export for testing
