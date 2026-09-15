import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import { env, isProd } from "../../config/env.js";
import * as authService from "./auth.service.js";

const REFRESH_COOKIE = "nt_refresh";

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    ...(isProd ? { domain: env.COOKIE_DOMAIN } : {}),
    path: "/auth",
    expires: expiresAt
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/auth", ...(isProd ? { domain: env.COOKIE_DOMAIN } : {}) });
}

export const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, verifyToken } = await authService.registerUser(email, password);

  // In production this token is emailed, never returned in the API response.
  const devOnlyVerifyToken = isProd ? undefined : verifyToken;

  res.status(201).json({
    id: user.id,
    email: user.email,
    devOnlyVerifyToken
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  res.status(200).json({ message: "Email verified" });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const session = await authService.loginUser(email, password, {
    userAgent: req.headers["user-agent"],
    ip: req.ip
  });
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  res.status(200).json({ accessToken: session.accessToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (!presented) throw new AppError("UNAUTHORIZED", "No session present");

  const session = await authService.rotateRefreshToken(presented, {
    userAgent: req.headers["user-agent"],
    ip: req.ip
  });
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  res.status(200).json({ accessToken: session.accessToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (presented) await authService.revokeRefreshFamily(presented);
  clearRefreshCookie(res);
  res.status(204).send();
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  res.status(200).json({ message: "If that email exists, a reset link has been sent" });
});

export const confirmPasswordReset = asyncHandler(async (req, res) => {
  await authService.confirmPasswordReset(req.body.token, req.body.newPassword);
  res.status(200).json({ message: "Password updated" });
});
