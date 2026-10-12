import { z } from "zod";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { localDateString, parseLocalDate } from "../../lib/dates.js";
import * as service from "./diary.service.js";

const diaryQuerySchema = z.object({ query: z.object({ date: localDateString }) });
const idParam = z.object({ id: z.string().uuid() });
const updateRecipeLogSchema = z.object({
  params: idParam,
  body: z.object({ servingsConsumed: z.number().positive().max(1000) })
});
const recipeLogParamSchema = z.object({ params: idParam });

export const diaryRouter = Router();
diaryRouter.use(requireAuth);

diaryRouter.get(
  "/",
  validate(diaryQuerySchema),
  asyncHandler(async (req, res) => {
    const { date } = req.query as unknown as { date: string };
    res.status(200).json(await service.getDiary(req.user!.id, parseLocalDate(date)));
  })
);

diaryRouter.put(
  "/recipe-logs/:id",
  validate(updateRecipeLogSchema),
  asyncHandler(async (req, res) => {
    res.status(200).json(await service.updateRecipeLog(req.user!.id, req.params.id, req.body.servingsConsumed));
  })
);

diaryRouter.delete(
  "/recipe-logs/:id",
  validate(recipeLogParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteRecipeLog(req.user!.id, req.params.id);
    res.status(204).send();
  })
);
