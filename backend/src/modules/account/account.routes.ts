import { z } from "zod";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { accountSensitiveLimiter } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { passwordSchema } from "../auth/auth.schemas.js";
import * as service from "./account.service.js";

const deleteAccountSchema = z.object({
  body: z.object({ password: z.string().min(1).max(128) })
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema
  })
});

const changeEmailSchema = z.object({
  body: z.object({
    newEmail: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128)
  })
});

const sessionIdSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const accountRouter = Router();
accountRouter.use(requireAuth);

accountRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.status(200).json(await service.getAccountInfo(req.user!.id));
  })
);

accountRouter.post(
  "/change-password",
  accountSensitiveLimiter,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await service.changePassword(req.user!.id, req.user!.sessionId, req.body.currentPassword, req.body.newPassword);
    res.status(200).json({ message: "Password updated. Your other devices were signed out." });
  })
);

accountRouter.post(
  "/change-email",
  accountSensitiveLimiter,
  validate(changeEmailSchema),
  asyncHandler(async (req, res) => {
    res.status(200).json(await service.changeEmail(req.user!.id, req.body.newEmail, req.body.password));
  })
);

accountRouter.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    res.status(200).json(await service.listSessions(req.user!.id, req.user!.sessionId));
  })
);

accountRouter.post(
  "/sessions/revoke-others",
  asyncHandler(async (req, res) => {
    await service.revokeAllOtherSessions(req.user!.id, req.user!.sessionId);
    res.status(204).send();
  })
);

accountRouter.delete(
  "/sessions/:id",
  validate(sessionIdSchema),
  asyncHandler(async (req, res) => {
    await service.revokeSession(req.user!.id, req.params.id, req.user!.sessionId);
    res.status(204).send();
  })
);

accountRouter.delete(
  "/me",
  accountSensitiveLimiter,
  validate(deleteAccountSchema),
  asyncHandler(async (req, res) => {
    await service.deleteAccount(req.user!.id, req.body.password);
    res.status(204).send();
  })
);
