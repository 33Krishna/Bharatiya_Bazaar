import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/bharatiya_bazaar";

export async function connectDB(): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      autoIndex: true, // Auto-build indexes in development/test
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error}`);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
