import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  integer,
  jsonb,
  uniqueIndex,
  index,
  check
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["USER", "ADMIN"]);
export const sexEnum = pgEnum("sex", ["MALE", "FEMALE"]);
export const unitPrefEnum = pgEnum("unit_pref", ["METRIC", "IMPERIAL"]);
export const activityLevelEnum = pgEnum("activity_level", [
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE"
]);
export const goalTypeEnum = pgEnum("goal_type", ["LOSE", "MAINTAIN", "GAIN"]);
export const foodSourceEnum = pgEnum("food_source", ["SYSTEM", "USER", "IMPORTED", "AI_ESTIMATED"]);
export const verificationStatusEnum = pgEnum("verification_status", ["UNVERIFIED", "VERIFIED", "FLAGGED"]);
export const servingUnitEnum = pgEnum("serving_unit", ["G", "ML", "PIECE", "CUP", "TBSP", "TSP", "OZ"]);
export const mealTypeEnum = pgEnum("meal_type", ["BREAKFAST", "LUNCH", "DINNER", "SNACK", "CUSTOM"]);
export const entrySourceEnum = pgEnum("entry_source", ["MANUAL", "AI_ESTIMATED"]);
export const exportStatusEnum = pgEnum("export_status", ["PENDING", "READY", "EXPIRED", "FAILED"]);
export const exportFormatEnum = pgEnum("export_format", ["JSON", "CSV"]);
export const verificationPurposeEnum = pgEnum("verification_purpose", ["EMAIL_VERIFY", "PASSWORD_RESET"]);

const id = () => uuid("id").primaryKey().$defaultFn(randomUUID);
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("USER"),
  ...timestamps
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    familyId: uuid("family_id").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: text("ip")
  },
  (t) => ({
    userIdx: index("refresh_tokens_user_idx").on(t.userId),
    familyIdx: index("refresh_tokens_family_idx").on(t.familyId)
  })
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    purpose: verificationPurposeEnum("purpose").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userPurposeIdx: index("verification_tokens_user_purpose_idx").on(t.userId, t.purpose)
  })
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dateOfBirth: date("date_of_birth", { mode: "date" }),
  sexForCalc: sexEnum("sex_for_calc"),
  heightCm: numeric("height_cm", { precision: 6, scale: 2 }).$type<number>(),
  unitPref: unitPrefEnum("unit_pref").notNull().default("METRIC"),
  timezone: text("timezone").notNull().default("UTC"),
  activityLevel: activityLevelEnum("activity_level").notNull().default("SEDENTARY"),
  goal: goalTypeEnum("goal").notNull().default("MAINTAIN"),
  targetWeightKg: numeric("target_weight_kg", { precision: 6, scale: 2 }).$type<number>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const goalsHistory = pgTable(
  "goals_history",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2 }).$type<number>().notNull(),
    heightCm: numeric("height_cm", { precision: 6, scale: 2 }).$type<number>().notNull(),
    activityLevel: activityLevelEnum("activity_level").notNull(),
    goal: goalTypeEnum("goal").notNull(),
    sexForCalc: sexEnum("sex_for_calc").notNull(),
    calculatedBmr: numeric("calculated_bmr", { precision: 8, scale: 2 }).$type<number>().notNull(),
    calculatedTdee: numeric("calculated_tdee", { precision: 8, scale: 2 }).$type<number>().notNull(),
    calorieTarget: numeric("calorie_target", { precision: 8, scale: 2 }).$type<number>().notNull(),
    proteinGTarget: numeric("protein_g_target", { precision: 8, scale: 2 }).$type<number>().notNull(),
    carbGTarget: numeric("carb_g_target", { precision: 8, scale: 2 }).$type<number>().notNull(),
    fatGTarget: numeric("fat_g_target", { precision: 8, scale: 2 }).$type<number>().notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userEffectiveIdx: index("goals_history_user_effective_idx").on(t.userId, t.effectiveFrom)
  })
);

export const weights = pgTable(
  "weights",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2 }).$type<number>().notNull(),
    recordedAt: date("recorded_at", { mode: "date" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userDateUnique: uniqueIndex("weights_user_date_unique").on(t.userId, t.recordedAt),
    weightPositive: check("weights_weight_positive", sql`${t.weightKg} > 0 AND ${t.weightKg} < 700`)
  })
);

export const foods = pgTable(
  "foods",
  {
    id: id(),
    name: text("name").notNull(),
    brand: text("brand"),
    servingSize: numeric("serving_size", { precision: 8, scale: 2 }).$type<number>().notNull(),
    servingUnit: servingUnitEnum("serving_unit").notNull(),
    calories: numeric("calories", { precision: 8, scale: 2 }).$type<number>().notNull(),
    proteinG: numeric("protein_g", { precision: 8, scale: 2 }).$type<number>().notNull(),
    carbG: numeric("carb_g", { precision: 8, scale: 2 }).$type<number>().notNull(),
    fatG: numeric("fat_g", { precision: 8, scale: 2 }).$type<number>().notNull(),
    fiberG: numeric("fiber_g", { precision: 8, scale: 2 }).$type<number>(),
    micronutrients: jsonb("micronutrients"),
    source: foodSourceEnum("source").notNull(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("UNVERIFIED"),
    ...timestamps
  },
  (t) => ({
    ownerIdx: index("foods_owner_idx").on(t.ownerId),
    nameIdx: index("foods_name_idx").on(t.name),
    positiveServing: check("foods_serving_positive", sql`${t.servingSize} > 0`),
    nonNegativeMacros: check(
      "foods_macros_non_negative",
      sql`${t.calories} >= 0 AND ${t.proteinG} >= 0 AND ${t.carbG} >= 0 AND ${t.fatG} >= 0`
    )
  })
);

export const foodLogs = pgTable(
  "food_logs",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    foodNameSnapshot: text("food_name_snapshot").notNull(),
    caloriesSnapshot: numeric("calories_snapshot", { precision: 8, scale: 2 }).$type<number>().notNull(),
    proteinGSnapshot: numeric("protein_g_snapshot", { precision: 8, scale: 2 }).$type<number>().notNull(),
    carbGSnapshot: numeric("carb_g_snapshot", { precision: 8, scale: 2 }).$type<number>().notNull(),
    fatGSnapshot: numeric("fat_g_snapshot", { precision: 8, scale: 2 }).$type<number>().notNull(),
    servingUnitSnapshot: servingUnitEnum("serving_unit_snapshot").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).$type<number>().notNull(),
    meal: mealTypeEnum("meal").notNull(),
    customMealLabel: text("custom_meal_label"),
    loggedDate: date("logged_date", { mode: "date" }).notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
    entrySource: entrySourceEnum("entry_source").notNull().default("MANUAL"),
    idempotencyKey: text("idempotency_key"),
    ...timestamps
  },
  (t) => ({
    userDateIdx: index("food_logs_user_date_idx").on(t.userId, t.loggedDate),
    userIdempotencyUnique: uniqueIndex("food_logs_user_idempotency_unique").on(t.userId, t.idempotencyKey),
    positiveQuantity: check("food_logs_quantity_positive", sql`${t.quantity} > 0 AND ${t.quantity} < 100000`)
  })
);

export const recipes = pgTable(
  "recipes",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    servings: numeric("servings", { precision: 8, scale: 2 }).$type<number>().notNull(),
    ...timestamps
  },
  (t) => ({
    ownerIdx: index("recipes_owner_idx").on(t.ownerId),
    positiveServings: check("recipes_servings_positive", sql`${t.servings} > 0`)
  })
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: id(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).$type<number>().notNull(),
    position: integer("position").notNull()
  },
  (t) => ({
    recipeIdx: index("recipe_ingredients_recipe_idx").on(t.recipeId),
    positiveQuantity: check("recipe_ingredients_quantity_positive", sql`${t.quantity} > 0`)
  })
);

export const recipeLogs = pgTable(
  "recipe_logs",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    recipeNameSnapshot: text("recipe_name_snapshot").notNull(),
    caloriesSnapshot: numeric("calories_snapshot", { precision: 8, scale: 2 }).$type<number>().notNull(),
    proteinGSnapshot: numeric("protein_g_snapshot", { precision: 8, scale: 2 }).$type<number>().notNull(),
    carbGSnapshot: numeric("carb_g_snapshot", { precision: 8, scale: 2 }).$type<number>().notNull(),
    fatGSnapshot: numeric("fat_g_snapshot", { precision: 8, scale: 2 }).$type<number>().notNull(),
    servingsConsumed: numeric("servings_consumed", { precision: 8, scale: 2 }).$type<number>().notNull(),
    meal: mealTypeEnum("meal").notNull(),
    loggedDate: date("logged_date", { mode: "date" }).notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userDateIdx: index("recipe_logs_user_date_idx").on(t.userId, t.loggedDate),
    positiveServingsConsumed: check("recipe_logs_servings_positive", sql`${t.servingsConsumed} > 0`)
  })
);

export const aiParseRequests = pgTable(
  "ai_parse_requests",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawText: text("raw_text").notNull(),
    parsedOutput: jsonb("parsed_output").notNull(),
    accepted: boolean("accepted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userCreatedIdx: index("ai_parse_requests_user_created_idx").on(t.userId, t.createdAt)
  })
);

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: exportStatusEnum("status").notNull().default("PENDING"),
    filePath: text("file_path"),
    format: exportFormatEnum("format").notNull(),
    downloadTokenHash: text("download_token_hash").unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userIdx: index("export_jobs_user_idx").on(t.userId)
  })
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: id(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    targetTable: text("target_table").notNull(),
    targetId: text("target_id").notNull(),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    adminIdx: index("admin_audit_log_admin_idx").on(t.adminUserId),
    targetIdx: index("admin_audit_log_target_idx").on(t.targetTable, t.targetId)
  })
);
