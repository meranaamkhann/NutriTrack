import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { upsertWeightSchema, listWeightsSchema, weightIdParamSchema } from "./weights.schemas.js";
import * as ctrl from "./weights.controller.js";

export const weightsRouter = Router();
weightsRouter.use(requireAuth);

weightsRouter.post("/", validate(upsertWeightSchema), ctrl.upsertWeight);
weightsRouter.get("/", validate(listWeightsSchema), ctrl.listWeights);
weightsRouter.delete("/:id", validate(weightIdParamSchema), ctrl.deleteWeight);
