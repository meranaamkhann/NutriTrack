import { eq, desc, and, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { profiles, weights, goalsHistory } from "../../db/schema.js";
import { AppError } from "../../utils/AppError.js";
import { ageFromDateOfBirth, calculateAll, calculateMacros } from "../calc/calc.service.js";
import { localDateInTimezone } from "../../lib/timezone.js";
import { upsertWeight } from "../weights/weights.service.js";

type ProfilePatch = Partial<typeof profiles.$inferInsert>;

export async function getOrCreateProfile(userId: string) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(profiles).values({ userId }).returning();
  return created;
}

export async function updateProfile(userId: string, patch: ProfilePatch) {
  await getOrCreateProfile(userId);
  const [updated] = await db
    .update(profiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))
    .returning();
  return updated;
}

export async function recalculateGoals(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) throw new AppError("BAD_REQUEST", "Complete your profile before calculating goals");

  const [latestWeight] = await db
    .select()
    .from(weights)
    .where(eq(weights.userId, userId))
    .orderBy(desc(weights.recordedAt))
    .limit(1);

  if (!profile.dateOfBirth || !profile.sexForCalc || !profile.heightCm || !latestWeight) {
    throw new AppError(
      "BAD_REQUEST",
      "Date of birth, sex, height, and at least one weight entry are required to calculate goals"
    );
  }

  const input = {
    weightKg: Number(latestWeight.weightKg),
    heightCm: Number(profile.heightCm),
    ageYears: ageFromDateOfBirth(profile.dateOfBirth),
    sex: profile.sexForCalc,
    activityLevel: profile.activityLevel,
    goal: profile.goal
  };

  const result = calculateAll(input);

  const [created] = await db
    .insert(goalsHistory)
    .values({
      userId,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      activityLevel: input.activityLevel,
      goal: input.goal,
      sexForCalc: input.sex,
      calculatedBmr: result.bmr,
      calculatedTdee: result.tdee,
      calorieTarget: result.calorieTarget,
      proteinGTarget: result.proteinG,
      carbGTarget: result.carbG,
      fatGTarget: result.fatG,
      effectiveFrom: new Date()
    })
    .returning();

  return created;
}

export async function getCurrentGoals(userId: string) {
  const [goal] = await db
    .select()
    .from(goalsHistory)
    .where(eq(goalsHistory.userId, userId))
    .orderBy(desc(goalsHistory.effectiveFrom))
    .limit(1);
  return goal ?? null;
}

export async function getGoalsForDate(userId: string, date: Date) {
  const [goal] = await db
    .select()
    .from(goalsHistory)
    .where(and(eq(goalsHistory.userId, userId), lte(goalsHistory.effectiveFrom, date)))
    .orderBy(desc(goalsHistory.effectiveFrom))
    .limit(1);
  return goal ?? null;
}

export interface SetupInput {
  displayName?: string | null;
  dateOfBirth: Date;
  sexForCalc: "MALE" | "FEMALE";
  heightCm: number;
  weightKg: number;
  activityLevel: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
  goal: "LOSE" | "MAINTAIN" | "GAIN";
  targetWeightKg?: number | null;
  unitPref?: "METRIC" | "IMPERIAL";
  timezone?: string;
}

// Pure calculation, nothing is written. Used by the setup wizard's review
// step so the formulas stay in exactly one place (the server).
export function previewGoals(input: SetupInput) {
  return calculateAll({
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    ageYears: ageFromDateOfBirth(input.dateOfBirth),
    sex: input.sexForCalc,
    activityLevel: input.activityLevel,
    goal: input.goal
  });
}

// One call from the onboarding wizard: profile + first weight + first
// target. Validates by running the calculation BEFORE writing anything, so
// an out-of-range age or weight can't leave a half-completed setup behind.
export async function completeSetup(userId: string, input: SetupInput) {
  previewGoals(input);

  const profile = await updateProfile(userId, {
    displayName: input.displayName?.trim() || null,
    dateOfBirth: input.dateOfBirth,
    sexForCalc: input.sexForCalc,
    heightCm: input.heightCm,
    activityLevel: input.activityLevel,
    goal: input.goal,
    targetWeightKg: input.targetWeightKg ?? null,
    ...(input.unitPref ? { unitPref: input.unitPref } : {}),
    ...(input.timezone ? { timezone: input.timezone } : {})
  });

  await upsertWeight(userId, {
    weightKg: input.weightKg,
    recordedAt: localDateInTimezone(new Date(), profile.timezone)
  });

  const goal = await recalculateGoals(userId);
  return { profile, goal };
}

export async function setManualGoal(
  userId: string,
  input: { calorieTarget: number; proteinG?: number; carbG?: number; fatG?: number }
) {
  const macros =
    input.proteinG !== undefined && input.carbG !== undefined && input.fatG !== undefined
      ? { proteinG: input.proteinG, carbG: input.carbG, fatG: input.fatG }
      : calculateMacros(input.calorieTarget);

  const [created] = await db
    .insert(goalsHistory)
    .values({
      userId,
      calorieTarget: input.calorieTarget,
      proteinGTarget: macros.proteinG,
      carbGTarget: macros.carbG,
      fatGTarget: macros.fatG,
      source: "MANUAL",
      effectiveFrom: new Date()
    })
    .returning();
  return created;
}

export async function listGoalHistory(userId: string) {
  return db
    .select()
    .from(goalsHistory)
    .where(eq(goalsHistory.userId, userId))
    .orderBy(desc(goalsHistory.effectiveFrom))
    .limit(20);
}
