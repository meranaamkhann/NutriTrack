import { AppError } from "../utils/AppError.js";

// Nutrition snapshot columns are numeric(8,2): anything >= 1,000,000 makes
// Postgres throw "numeric field overflow". Check up front so the caller gets
// a clear 400 instead of a 500.
const MAX_SNAPSHOT_VALUE = 999_999.99;

export function assertSnapshotsFit(values: number[]): void {
  for (const v of values) {
    if (!Number.isFinite(v) || v > MAX_SNAPSHOT_VALUE) {
      throw new AppError("BAD_REQUEST", "That portion is too large to log. Check the quantity and the food's serving size.");
    }
  }
}

export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Spreadsheet apps run cells that start with these as formulas.
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
