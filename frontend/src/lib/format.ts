import type { ServingUnit } from "./types";

const UNIT_LABELS: Record<ServingUnit, [string, string]> = {
  G: ["g", "g"],
  ML: ["ml", "ml"],
  PIECE: ["piece", "pieces"],
  CUP: ["cup", "cups"],
  TBSP: ["tbsp", "tbsp"],
  TSP: ["tsp", "tsp"],
  OZ: ["oz", "oz"]
};

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function unitLabel(unit: ServingUnit | "SERVING", amount = 2): string {
  if (unit === "SERVING") return amount === 1 ? "serving" : "servings";
  return UNIT_LABELS[unit][amount === 1 ? 0 : 1];
}

export function formatAmount(amount: number, unit: ServingUnit | "SERVING"): string {
  const label = unitLabel(unit, amount);
  // Compact for metric units ("200 g"), spaced words otherwise ("1 piece").
  return `${trim(amount)} ${label}`;
}

export function kcal(n: number): string {
  return Math.round(n).toLocaleString();
}
