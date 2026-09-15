import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createLogSchema, updateLogSchema, logIdParamSchema, listLogsSchema } from "./logs.schemas.js";
import * as ctrl from "./logs.controller.js";

export const logsRouter = Router();
logsRouter.use(requireAuth);

logsRouter.get("/", validate(listLogsSchema), ctrl.listLogsForDate);
logsRouter.post("/", validate(createLogSchema), ctrl.createLog);
logsRouter.put("/:id", validate(updateLogSchema), ctrl.updateLog);
logsRouter.delete("/:id", validate(logIdParamSchema), ctrl.deleteLog);
