import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { aiParseLimiter } from "../../middleware/rateLimit.js";
import { parseRequestSchema, acceptParseSchema } from "./ai.schemas.js";
import * as ctrl from "./ai.controller.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.post("/parse", aiParseLimiter, validate(parseRequestSchema), ctrl.requestParse);
aiRouter.post("/parse/:id/accept", validate(acceptParseSchema), ctrl.acceptParse);
