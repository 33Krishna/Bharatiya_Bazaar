"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkHealth = checkHealth;
exports.checkDbHealth = checkDbHealth;
const mongoose_1 = __importDefault(require("mongoose"));
async function checkHealth(req, res) {
    res.json({
        success: true,
        message: "OK",
        timestamp: new Date().toISOString()
    });
}
async function checkDbHealth(req, res) {
    const isConnected = mongoose_1.default.connection.readyState === 1;
    res.json({
        success: true,
        status: isConnected ? "UP" : "DOWN",
        timestamp: new Date().toISOString()
    });
}
