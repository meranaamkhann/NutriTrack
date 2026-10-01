import { z } from "zod";
import { Router } from "express";
import { eq } from "drizzle-orm";
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

adminRouter.get(
  "/audit-log",
  asyncHandler(async (_req, res) => {
    const entries = await db.select().from(adminAuditLog).orderBy(adminAuditLog.createdAt);
    res.status(200).json(entries);
  })
);
