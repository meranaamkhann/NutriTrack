export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "CUSTOM";
export type ServingUnit = "G" | "ML" | "PIECE" | "CUP" | "TBSP" | "TSP" | "OZ";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
export type GoalType = "LOSE" | "MAINTAIN" | "GAIN";
export type Sex = "MALE" | "FEMALE";
export type UnitPref = "METRIC" | "IMPERIAL";

export interface Profile {
  userId: string;
  displayName: string | null;
  dateOfBirth: string | null;
  sexForCalc: Sex | null;
  heightCm: string | null;
  unitPref: UnitPref;
  timezone: string;
  activityLevel: ActivityLevel;
  goal: GoalType;
  targetWeightKg: string | null;
}

export interface GoalHistoryEntry {
  id: string;
  source: "CALCULATED" | "MANUAL";
  calculatedBmr: string;
  calculatedTdee: string;
  calorieTarget: string;
  proteinGTarget: string;
  carbGTarget: string;
  fatGTarget: string;
  effectiveFrom: string;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  servingSize: string;
  servingUnit: ServingUnit;
  calories: string;
  proteinG: string;
  carbG: string;
  fatG: string;
  source: "SYSTEM" | "USER" | "IMPORTED" | "AI_ESTIMATED";
  ownerId: string | null;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "FLAGGED";
}

export interface FoodLog {
  id: string;
  foodId: string | null;
  foodNameSnapshot: string;
  caloriesSnapshot: string;
  proteinGSnapshot: string;
  carbGSnapshot: string;
  fatGSnapshot: string;
  quantity: string;
  meal: MealType;
  loggedAt: string;
  entrySource: "MANUAL" | "AI_ESTIMATED";
}

export interface Weight {
  id: string;
  weightKg: string;
  recordedAt: string;
  note: string | null;
}

export interface Recipe {
  id: string;
  name: string;
  servings: string;
}

export interface RecipeDetail {
  recipe: Recipe;
  ingredients: { ingredient: { quantity: string }; food: Food }[];
  totals: { calories: number; proteinG: number; carbG: number; fatG: number };
  perServing: { calories: number; proteinG: number; carbG: number; fatG: number };
}

export interface DailyProgress {
  days: {
    date: string;
    totals: { calories: number; proteinG: number; carbG: number; fatG: number };
    calorieTarget: number | null;
  }[];
  weights: { date: string; weightKg: number }[];
}

export interface AiParsedItem {
  name: string;
  quantity: number;
  unit: ServingUnit;
  meal: MealType;
  estimatedCalories: number;
  estimatedProteinG: number;
  estimatedCarbG: number;
  estimatedFatG: number;
}

export interface AccountInfo {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  role: "USER" | "ADMIN";
}

export interface DiaryEntry {
  id: string;
  kind: "FOOD" | "RECIPE";
  name: string;
  amount: number;
  unit: ServingUnit | "SERVING";
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  meal: MealType;
  loggedAt: string;
  source: "MANUAL" | "AI_ESTIMATED";
}

export interface DiaryGoal {
  calorieTarget: number;
  proteinGTarget: number;
  carbGTarget: number;
  fatGTarget: number;
  source: "CALCULATED" | "MANUAL";
  effectiveFrom: string;
}

export interface Diary {
  date: string;
  entries: DiaryEntry[];
  goal: DiaryGoal | null;
}

export interface GoalPreview {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface SessionInfo {
  id: string;
  device: string;
  ip: string | null;
  lastActiveAt: string;
  current: boolean;
}
