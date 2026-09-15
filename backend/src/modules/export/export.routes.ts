import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { exportLimiter } from "../../middleware/rateLimit.js";
import { createExportSchema, exportIdParamSchema } from "./export.schemas.js";
import * as ctrl from "./export.controller.js";

export const exportRouter = Router();
exportRouter.use(requireAuth);

exportRouter.post("/", exportLimiter, validate(createExportSchema), ctrl.createExport);
exportRouter.get("/:id", validate(exportIdParamSchema), ctrl.downloadExport);
