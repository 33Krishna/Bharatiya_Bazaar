import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/bharatiya_bazaar";

export async function connectDB(): Promise<typeof mongoose | undefined> {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      autoIndex: true, // Auto-build indexes in development/test
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error}`);
    console.warn("⚠️ Warning: Server is running but database connection is NOT active. Please whitelist your IP on MongoDB Atlas or start a local MongoDB instance.");
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
