import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;

function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const localDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine(isRealCalendarDate, "That is not a real calendar date");

export function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// Bounds are evaluated per request, never at import time. Computing
// `Date.now() + 24h` once at module load freezes the limit at server start,
// so a server that has been up for more than a day rejects every new log.
export const instantNotFarFuture = z.coerce
  .date()
  .refine((d) => d.getTime() <= Date.now() + DAY_MS, "That time is too far in the future");

export const loggableDateString = localDateString.refine((value) => {
  const t = parseLocalDate(value).getTime();
  return t <= Date.now() + 2 * DAY_MS && t >= Date.UTC(2000, 0, 1);
}, "That date is outside the range you can log to");

export function endOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
