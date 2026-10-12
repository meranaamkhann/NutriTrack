import type { MealType } from "../../lib/types";

export const MEALS: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snacks",
  CUSTOM: "Other"
};

// Which meal to suggest by default, from the time of day.
export function defaultMealForNow(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 21) return "DINNER";
  return "SNACK";
}
