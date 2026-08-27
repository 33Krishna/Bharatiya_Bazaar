import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AdminUser } from "../models/AdminUser";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";

/**
 * Dedicated Admin Authentication Middleware.
 * Enforces decoded.type === "ADMIN" and minimum ADMIN or SUPER_ADMIN role (no SUPPORT).
 */
export default function requireAdmin(roles: string[] = ["ADMIN", "SUPER_ADMIN"]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" }
      });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);

      // Strict token type assertion: Must be an ADMIN token
      if (decoded.type !== "ADMIN") {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid token type: Admin authentication required" }
        });
      }

      const admin = await AdminUser.findById(decoded.id).exec();
      if (!admin || admin.status !== "ACTIVE") {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Admin account not found or inactive" }
        });
      }

      if (!roles.includes(admin.role)) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: `Insufficient permissions: Requires ${roles.join(" or ")}` }
        });
      }

      req.admin = admin;
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired admin token" }
      });
    }
  };
}
