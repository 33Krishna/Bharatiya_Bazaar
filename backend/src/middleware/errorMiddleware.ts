import { Request, Response, NextFunction } from "express";

export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction): any {
  console.error("Error encountered:", err);

  let statusCode = 500;
  let errorCode = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred.";

  // 1. Zod Validation Error
  if (err.name === "ZodError") {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    message = "Invalid request payload.";
    return res.status(statusCode).json({
      success: false,
      error: { code: errorCode, message, details: err.errors }
    });
  }

  // 2. MongoDB Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : "field";
    
    // Map DB field names to user-friendly names
    const friendlyNames: Record<string, string> = {
      mobile: "mobile number",
      email: "email address",
      memberCode: "member code",
      cardNumber: "card number",
      globalPosition: "global position",
      runDate: "settlement date"
    };
    
    const friendlyField = friendlyNames[field] || field;
    
    return res.status(409).json({ 
      success: false, 
      error: { 
        code: "DUPLICATE_ENTRY", 
        message: `This ${friendlyField} is already registered. Please use a different one.` 
      } 
    });
  }

  // 3. Custom Error status / code
  if (err.status || err.statusCode) {
    statusCode = err.status || err.statusCode;
    errorCode = err.code || (statusCode === 403 ? "FORBIDDEN" : statusCode === 401 ? "UNAUTHORIZED" : statusCode === 404 ? "NOT_FOUND" : "BAD_REQUEST");
    message = err.message;
  }
  else if (err.message && (err.message.includes("Invalid") || err.message.includes("Cannot purchase"))) {
    statusCode = 400;
    errorCode = "BAD_REQUEST";
    message = err.message;
  }

  // Default fallback response
  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message
    }
  });
}
