import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { updateProfileSchema, goalsForDateSchema } from "./profile.schemas.js";
import * as ctrl from "./profile.controller.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get("/me", ctrl.getProfile);
profileRouter.put("/me", validate(updateProfileSchema), ctrl.updateProfile);
profileRouter.post("/me/goals/recalculate", ctrl.recalculateGoals);
profileRouter.get("/me/goals/current", ctrl.getCurrentGoals);
profileRouter.get("/me/goals/for-date", validate(goalsForDateSchema), ctrl.getGoalsForDate);
