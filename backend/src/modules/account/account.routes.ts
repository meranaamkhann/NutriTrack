import { z } from "zod";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./account.service.js";

const deleteAccountSchema = z.object({
  body: z.object({ password: z.string().min(1).max(128) })
});

export const accountRouter = Router();
accountRouter.use(requireAuth);

accountRouter.delete(
  "/me",
  validate(deleteAccountSchema),
  asyncHandler(async (req, res) => {
    await service.deleteAccount(req.user!.id, req.body.password);
    res.status(204).send();
  })
);
