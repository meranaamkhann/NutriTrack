import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { progressRangeSchema } from "./progress.schemas.js";
import { getDailyProgress } from "./progress.service.js";

export const progressRouter = Router();
progressRouter.use(requireAuth);

progressRouter.get(
  "/",
  validate(progressRangeSchema),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as unknown as { from: Date; to: Date };
    const result = await getDailyProgress(req.user!.id, from, to);
    res.status(200).json(result);
  })
);
