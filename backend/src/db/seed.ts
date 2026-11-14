import { and, eq, isNull } from "drizzle-orm";
import { db, pool } from "./client.js";
import { foods } from "./schema.js";
import { SEED_FOODS } from "./seed-foods.js";

// Adds the starter foods every user can search (no owner, source SYSTEM).
// Safe to run repeatedly: a food that already exists by name is left alone, so
// it never duplicates and never overwrites an admin's edits.
export async function seedFoods(): Promise<{ added: number; skipped: number }> {
  const existing = await db.select({ name: foods.name }).from(foods).where(and(isNull(foods.ownerId), eq(foods.source, "SYSTEM")));
  const have = new Set(existing.map((r) => r.name));
  const missing = SEED_FOODS.filter((food) => !have.has(food.name));

  if (missing.length > 0) {
    await db.insert(foods).values(
      missing.map((food) => ({
        ...food,
        source: "SYSTEM" as const,
        ownerId: null,
        verificationStatus: "VERIFIED" as const
      }))
    );
  }
  return { added: missing.length, skipped: SEED_FOODS.length - missing.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedFoods()
    .then(({ added, skipped }) => console.log(`Seeded foods: ${added} added, ${skipped} already present`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
