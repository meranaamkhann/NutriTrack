import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "../utils/AppError.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: "USER" | "ADMIN" };
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHORIZED", "Missing access token");
    }
    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);

    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user) throw new AppError("UNAUTHORIZED", "Invalid session");

    req.user = { id: user.id, role: user.role };
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid or expired access token"));
  }
}

export function requireRole(role: "ADMIN") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      next(new AppError("FORBIDDEN", "Insufficient privileges"));
      return;
    }
    next();
  };
}
