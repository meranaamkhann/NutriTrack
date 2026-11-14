import { z } from "zod";
import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { db } from "../../db/client.js";
import { foods, adminAuditLog } from "../../db/schema.js";

const verifyFoodSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ status: z.enum(["VERIFIED", "FLAGGED", "UNVERIFIED"]) })
});

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.put(
  "/foods/:id/verify",
  validate(verifyFoodSchema),
  asyncHandler(async (req, res) => {
    const before = await db.select().from(foods).where(eq(foods.id, req.params.id)).limit(1);
    const [food] = await db
      .update(foods)
      .set({ verificationStatus: req.body.status })
      .where(eq(foods.id, req.params.id))
      .returning();

    await db.insert(adminAuditLog).values({
      adminUserId: req.user!.id,
      action: "food.verify",
      targetTable: "foods",
      targetId: req.params.id,
      detail: { from: before[0]?.verificationStatus ?? null, to: req.body.status }
    });

    res.status(200).json(food);
  })
);

const auditLogQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0)
  })
});

adminRouter.get(
  "/audit-log",
  validate(auditLogQuerySchema),
  asyncHandler(async (req, res) => {
    const { limit, offset } = req.query as unknown as { limit: number; offset: number };
    const entries = await db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit).offset(offset);
    res.status(200).json(entries);
  })
);
