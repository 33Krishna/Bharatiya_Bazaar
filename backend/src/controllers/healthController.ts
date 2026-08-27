import { Request, Response } from "express";
import mongoose from "mongoose";

export async function checkHealth(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    message: "OK",
    timestamp: new Date().toISOString()
  });
}

export async function checkDbHealth(req: Request, res: Response): Promise<void> {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    success: true,
    status: isConnected ? "UP" : "DOWN",
    timestamp: new Date().toISOString()
  });
}
