CREATE TYPE "public"."goal_source" AS ENUM('CALCULATED', 'MANUAL');--> statement-breakpoint
ALTER TABLE "goals_history" ALTER COLUMN "weight_kg" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goals_history" ALTER COLUMN "height_cm" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goals_history" ALTER COLUMN "activity_level" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goals_history" ALTER COLUMN "goal" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goals_history" ALTER COLUMN "sex_for_calc" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goals_history" ALTER COLUMN "calculated_bmr" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goals_history" ALTER COLUMN "calculated_tdee" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goals_history" ADD COLUMN "source" "goal_source" DEFAULT 'CALCULATED' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;