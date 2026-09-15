import { AppError } from "../../utils/AppError.js";
import type { ActivityLevel, CalcInput, CalcResult, GoalType } from "./calc.types.js";

// Formula: Mifflin-St Jeor BMR (kcal/day).
// Male:   10 * weightKg + 6.25 * heightCm - 5 * age + 5
// Female: 10 * weightKg + 6.25 * heightCm - 5 * age - 161
// This is an estimate; individual metabolism varies by up to ~10-15%.
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9
};

// Conservative, widely-cited surplus/deficit for ~0.45kg/week change.
const GOAL_ADJUSTMENT_KCAL: Record<GoalType, number> = {
  LOSE: -500,
  MAINTAIN: 0,
  GAIN: 500
};

const MIN_CALORIE_TARGET = 1200;

const BOUNDS = {
  weightKg: { min: 20, max: 400 },
  heightCm: { min: 90, max: 260 },
  ageYears: { min: 13, max: 120 }
};

function assertFinitePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError("BAD_REQUEST", `${field} must be a finite positive number`);
  }
}

function assertInRange(value: number, field: string, min: number, max: number): void {
  if (value < min || value > max) {
    throw new AppError("BAD_REQUEST", `${field} must be between ${min} and ${max}`);
  }
}

export function validateCalcInput(input: CalcInput): void {
  assertFinitePositive(input.weightKg, "weightKg");
  assertFinitePositive(input.heightCm, "heightCm");
  assertFinitePositive(input.ageYears, "ageYears");
  assertInRange(input.weightKg, "weightKg", BOUNDS.weightKg.min, BOUNDS.weightKg.max);
  assertInRange(input.heightCm, "heightCm", BOUNDS.heightCm.min, BOUNDS.heightCm.max);
  assertInRange(input.ageYears, "ageYears", BOUNDS.ageYears.min, BOUNDS.ageYears.max);
}

export function calculateBmr(input: CalcInput): number {
  validateCalcInput(input);
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  const bmr = input.sex === "MALE" ? base + 5 : base - 161;
  return round2(Math.max(bmr, 0));
}

export function calculateTdee(input: CalcInput): number {
  const bmr = calculateBmr(input);
  return round2(bmr * ACTIVITY_MULTIPLIERS[input.activityLevel]);
}

export function calculateCalorieTarget(input: CalcInput): number {
  const tdee = calculateTdee(input);
  const target = tdee + GOAL_ADJUSTMENT_KCAL[input.goal];
  return round2(Math.max(target, MIN_CALORIE_TARGET));
}

// Default macro split: 30% protein / 40% carb / 30% fat of the calorie target.
// Protein & carbs = 4 kcal/g, fat = 9 kcal/g.
export function calculateMacros(calorieTarget: number): { proteinG: number; carbG: number; fatG: number } {
  assertFinitePositive(calorieTarget, "calorieTarget");
  return {
    proteinG: round2((calorieTarget * 0.3) / 4),
    carbG: round2((calorieTarget * 0.4) / 4),
    fatG: round2((calorieTarget * 0.3) / 9)
  };
}

export function calculateAll(input: CalcInput): CalcResult {
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(input);
  const calorieTarget = calculateCalorieTarget(input);
  const macros = calculateMacros(calorieTarget);
  return { bmr, tdee, calorieTarget, ...macros };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ageFromDateOfBirth(dateOfBirth: Date, at: Date = new Date()): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    at.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (at.getUTCMonth() === dateOfBirth.getUTCMonth() && at.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function lbToKg(lb: number): number {
  assertFinitePositive(lb, "weightLb");
  return round2(lb * 0.45359237);
}

export function kgToLb(kg: number): number {
  assertFinitePositive(kg, "weightKg");
  return round2(kg / 0.45359237);
}

export function inToCm(inches: number): number {
  assertFinitePositive(inches, "heightIn");
  return round2(inches * 2.54);
}

export function cmToIn(cm: number): number {
  assertFinitePositive(cm, "heightCm");
  return round2(cm / 2.54);
}
