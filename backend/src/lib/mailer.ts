import nodemailer from "nodemailer";
import { env, isProd } from "../config/env.js";
import { logger } from "./logger.js";

const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
    })
  : null;

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!transporter) {
    if (isProd) {
      // Fail loudly in production rather than silently dropping a
      // verification or password-reset email the user is waiting on.
      throw new Error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing)");
    }
    logger.info({ to: input.to, subject: input.subject }, "dev mode: email not sent, logging instead");
    // eslint-disable-next-line no-console
    console.log(`\n--- DEV EMAIL to ${input.to} ---\n${input.subject}\n\n${input.text}\n---\n`);
    return;
  }

  await transporter.sendMail({ from: env.SMTP_FROM, to: input.to, subject: input.subject, text: input.text, html: input.html });
}

export function verificationEmail(token: string) {
  const link = `${env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    subject: "Verify your NutriTrack email",
    text: `Verify your email: ${link}\n\nThis link expires in 24 hours.`,
    html: `<p>Verify your email by clicking the link below.</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`
  };
}

export function passwordResetEmail(token: string) {
  const link = `${env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    subject: "Reset your NutriTrack password",
    text: `Reset your password: ${link}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    html: `<p>Reset your password by clicking the link below.</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`
  };
}

export function passwordChangedEmail() {
  return {
    subject: "Your NutriTrack password was changed",
    text: "Your NutriTrack password was just changed and other devices were signed out.\n\nIf this wasn't you, reset your password immediately from the login page.",
    html: "<p>Your NutriTrack password was just changed and other devices were signed out.</p><p>If this wasn't you, reset your password immediately from the login page.</p>"
  };
}

export function emailChangedNoticeEmail(newEmail: string) {
  return {
    subject: "Your NutriTrack email address was changed",
    text: `The email on your NutriTrack account was changed to ${newEmail}.\n\nIf this wasn't you, contact support and reset your password right away.`,
    html: `<p>The email on your NutriTrack account was changed to <strong>${newEmail}</strong>.</p><p>If this wasn't you, contact support and reset your password right away.</p>`
  };
}
