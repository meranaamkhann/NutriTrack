import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    message: "Password must contain at least one letter and one number"
  });

export const registerSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordSchema
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128)
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({ token: z.string().min(1).max(512) })
});

export const passwordResetRequestSchema = z.object({
  body: z.object({ email: z.string().trim().toLowerCase().email().max(254) })
});

export const passwordResetConfirmSchema = z.object({
  body: z.object({
    token: z.string().min(1).max(512),
    newPassword: passwordSchema
  })
});