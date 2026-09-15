import express from "express";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { securityHeaders, corsMiddleware, requestId } from "./middleware/security.js";
import { generalApiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

import { authRouter } from "./modules/auth/auth.routes.js";
import { profileRouter } from "./modules/profile/profile.routes.js";
import { foodsRouter } from "./modules/foods/foods.routes.js";
import { logsRouter } from "./modules/logs/logs.routes.js";
import { weightsRouter } from "./modules/weights/weights.routes.js";
import { recipesRouter } from "./modules/recipes/recipes.routes.js";
import { progressRouter } from "./modules/progress/progress.routes.js";
import { exportRouter } from "./modules/export/export.routes.js";
import { accountRouter } from "./modules/account/account.routes.js";
import { adminRouter } from "./modules/account/admin.routes.js";
import { aiParseLimiter } from "./middleware/rateLimit.js";
import { requireAuth } from "./middleware/auth.js";
import { validate } from "./middleware/validate.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { parseRequestSchema, acceptParseSchema } from "./modules/ai/ai.schemas.js";
import * as aiService from "./modules/ai/ai.service.js";
import { Router } from "express";

export function buildApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestId);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(generalApiLimiter);

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.use("/auth", authRouter);
  app.use("/users", profileRouter);
  app.use("/foods", foodsRouter);
  app.use("/logs", logsRouter);
  app.use("/weights", weightsRouter);
  app.use("/recipes", recipesRouter);
  app.use("/progress", progressRouter);
  app.use("/export", exportRouter);
  app.use("/account", accountRouter);
  app.use("/admin", adminRouter);

  const aiRouter = Router();
  aiRouter.use(requireAuth);
  aiRouter.post(
    "/parse",
    aiParseLimiter,
    validate(parseRequestSchema),
    asyncHandler(async (req, res) => {
      const result = await aiService.requestParse(req.user!.id, req.body.rawText);
      res.status(201).json(result);
    })
  );
  aiRouter.post(
    "/parse/:id/accept",
    validate(acceptParseSchema),
    asyncHandler(async (req, res) => {
      const logs = await aiService.acceptParse(req.user!.id, req.params.id, req.body.items);
      res.status(201).json(logs);
    })
  );
  app.use("/ai", aiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
