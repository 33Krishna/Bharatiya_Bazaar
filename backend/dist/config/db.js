"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/bharatiya_bazaar";
async function connectDB() {
    try {
        const conn = await mongoose_1.default.connect(MONGODB_URI, {
            autoIndex: true, // Auto-build indexes in development/test
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    }
    catch (error) {
        console.error(`MongoDB Connection Error: ${error}`);
        process.exit(1);
    }
}
async function disconnectDB() {
    await mongoose_1.default.disconnect();
}
