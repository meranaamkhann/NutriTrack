import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "../utils/AppError.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: "USER" | "ADMIN"; sessionId?: string };
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new AppError("UNAUTHORIZED", "Missing access token"));
    return;
  }

  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid or expired access token"));
    return;
  }

  // A database failure here is a 500, not "your token is bad": reporting it
  // as 401 would make the client throw away a perfectly good session.
  try {
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user) {
      next(new AppError("UNAUTHORIZED", "Invalid session"));
      return;
    }

    req.user = { id: user.id, role: user.role, sessionId: payload.sid };
    next();
  } catch (err) {
    next(err);
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
