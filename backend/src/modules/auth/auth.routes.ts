import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { loginLimiter, registerLimiter, passwordResetLimiter } from "../../middleware/rateLimit.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema
} from "./auth.schemas.js";
import * as ctrl from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, validate(registerSchema), ctrl.register);
authRouter.post("/verify-email", validate(verifyEmailSchema), ctrl.verifyEmail);
authRouter.post(
  "/verify-email/resend",
  passwordResetLimiter,
  validate(passwordResetRequestSchema),
  ctrl.resendVerificationEmail
);
authRouter.post("/login", loginLimiter, validate(loginSchema), ctrl.login);
authRouter.post("/refresh", ctrl.refresh);
authRouter.post("/logout", ctrl.logout);
authRouter.post(
  "/password-reset/request",
  passwordResetLimiter,
  validate(passwordResetRequestSchema),
  ctrl.requestPasswordReset
);
authRouter.post(
  "/password-reset/confirm",
  passwordResetLimiter,
  validate(passwordResetConfirmSchema),
  ctrl.confirmPasswordReset
);
