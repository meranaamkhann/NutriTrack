import { sql } from "drizzle-orm";
import { db, pool } from "../../src/db/client.js";

const TABLES = [
  "recipe_logs",
  "recipe_ingredients",
  "recipes",
  "food_logs",
  "foods",
  "weights",
  "goals_history",
  "profiles",
  "ai_parse_requests",
  "export_jobs",
  "refresh_tokens",
  "verification_tokens",
  "users"
];

export async function truncateAll() {
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`));
}

export async function closeDb() {
  await pool.end();
}
