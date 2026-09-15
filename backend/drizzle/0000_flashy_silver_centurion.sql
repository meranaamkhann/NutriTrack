CREATE TYPE "public"."activity_level" AS ENUM('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');--> statement-breakpoint
CREATE TYPE "public"."entry_source" AS ENUM('MANUAL', 'AI_ESTIMATED');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('JSON', 'CSV');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('PENDING', 'READY', 'EXPIRED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."food_source" AS ENUM('SYSTEM', 'USER', 'IMPORTED', 'AI_ESTIMATED');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('LOSE', 'MAINTAIN', 'GAIN');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."serving_unit" AS ENUM('G', 'ML', 'PIECE', 'CUP', 'TBSP', 'TSP', 'OZ');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('MALE', 'FEMALE');--> statement-breakpoint
CREATE TYPE "public"."unit_pref" AS ENUM('METRIC', 'IMPERIAL');--> statement-breakpoint
CREATE TYPE "public"."verification_purpose" AS ENUM('EMAIL_VERIFY', 'PASSWORD_RESET');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('UNVERIFIED', 'VERIFIED', 'FLAGGED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_parse_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"parsed_output" jsonb NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "export_status" DEFAULT 'PENDING' NOT NULL,
	"file_path" text,
	"format" "export_format" NOT NULL,
	"download_token_hash" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_jobs_download_token_hash_unique" UNIQUE("download_token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "food_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"food_id" uuid,
	"food_name_snapshot" text NOT NULL,
	"calories_snapshot" numeric(8, 2) NOT NULL,
	"protein_g_snapshot" numeric(8, 2) NOT NULL,
	"carb_g_snapshot" numeric(8, 2) NOT NULL,
	"fat_g_snapshot" numeric(8, 2) NOT NULL,
	"serving_unit_snapshot" "serving_unit" NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"meal" "meal_type" NOT NULL,
	"custom_meal_label" text,
	"logged_date" date NOT NULL,
	"logged_at" timestamp with time zone NOT NULL,
	"entry_source" "entry_source" DEFAULT 'MANUAL' NOT NULL,
	"idempotency_key" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_logs_quantity_positive" CHECK ("food_logs"."quantity" > 0 AND "food_logs"."quantity" < 100000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "foods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"serving_size" numeric(8, 2) NOT NULL,
	"serving_unit" "serving_unit" NOT NULL,
	"calories" numeric(8, 2) NOT NULL,
	"protein_g" numeric(8, 2) NOT NULL,
	"carb_g" numeric(8, 2) NOT NULL,
	"fat_g" numeric(8, 2) NOT NULL,
	"fiber_g" numeric(8, 2),
	"micronutrients" jsonb,
	"source" "food_source" NOT NULL,
	"owner_id" uuid,
	"verification_status" "verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_serving_positive" CHECK ("foods"."serving_size" > 0),
	CONSTRAINT "foods_macros_non_negative" CHECK ("foods"."calories" >= 0 AND "foods"."protein_g" >= 0 AND "foods"."carb_g" >= 0 AND "foods"."fat_g" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"weight_kg" numeric(6, 2) NOT NULL,
	"height_cm" numeric(6, 2) NOT NULL,
	"activity_level" "activity_level" NOT NULL,
	"goal" "goal_type" NOT NULL,
	"sex_for_calc" "sex" NOT NULL,
	"calculated_bmr" numeric(8, 2) NOT NULL,
	"calculated_tdee" numeric(8, 2) NOT NULL,
	"calorie_target" numeric(8, 2) NOT NULL,
	"protein_g_target" numeric(8, 2) NOT NULL,
	"carb_g_target" numeric(8, 2) NOT NULL,
	"fat_g_target" numeric(8, 2) NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"date_of_birth" date,
	"sex_for_calc" "sex",
	"height_cm" numeric(6, 2),
	"unit_pref" "unit_pref" DEFAULT 'METRIC' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"activity_level" "activity_level" DEFAULT 'SEDENTARY' NOT NULL,
	"goal" "goal_type" DEFAULT 'MAINTAIN' NOT NULL,
	"target_weight_kg" numeric(6, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "recipe_ingredients_quantity_positive" CHECK ("recipe_ingredients"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"recipe_id" uuid,
	"recipe_name_snapshot" text NOT NULL,
	"calories_snapshot" numeric(8, 2) NOT NULL,
	"protein_g_snapshot" numeric(8, 2) NOT NULL,
	"carb_g_snapshot" numeric(8, 2) NOT NULL,
	"fat_g_snapshot" numeric(8, 2) NOT NULL,
	"servings_consumed" numeric(8, 2) NOT NULL,
	"meal" "meal_type" NOT NULL,
	"logged_date" date NOT NULL,
	"logged_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_logs_servings_positive" CHECK ("recipe_logs"."servings_consumed" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"servings" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_servings_positive" CHECK ("recipes"."servings" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" text,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" "verification_purpose" NOT NULL,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weights" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"weight_kg" numeric(6, 2) NOT NULL,
	"recorded_at" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weights_weight_positive" CHECK ("weights"."weight_kg" > 0 AND "weights"."weight_kg" < 700)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_parse_requests" ADD CONSTRAINT "ai_parse_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goals_history" ADD CONSTRAINT "goals_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_logs" ADD CONSTRAINT "recipe_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_logs" ADD CONSTRAINT "recipe_logs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weights" ADD CONSTRAINT "weights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_parse_requests_user_created_idx" ON "ai_parse_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "export_jobs_user_idx" ON "export_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_logs_user_date_idx" ON "food_logs" USING btree ("user_id","logged_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "food_logs_user_idempotency_unique" ON "food_logs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "foods_owner_idx" ON "foods" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "foods_name_idx" ON "foods" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goals_history_user_effective_idx" ON "goals_history" USING btree ("user_id","effective_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_ingredients_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_logs_user_date_idx" ON "recipe_logs" USING btree ("user_id","logged_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipes_owner_idx" ON "recipes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_tokens_user_purpose_idx" ON "verification_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weights_user_date_unique" ON "weights" USING btree ("user_id","recorded_at");