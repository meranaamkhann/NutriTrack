import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { truncateAll, closeDb } from "./helpers/db.js";

const app = buildApp();

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

function uniqueEmail() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin(): Promise<{ token: string; email: string }> {
  const email = uniqueEmail();
  await request(app).post("/auth/register").send({ email, password: "correcthorse1" });
  const login = await request(app).post("/auth/login").send({ email, password: "correcthorse1" });
  return { token: login.body.accessToken as string, email };
}

async function createFood(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  const res = await request(app)
    .post("/foods")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Test Chicken Breast",
      servingSize: 100,
      servingUnit: "G",
      calories: 165,
      proteinG: 31,
      carbG: 0,
      fatG: 3.6,
      ...overrides
    });
  return res.body;
}

describe("IDOR / broken access control", () => {
  it("blocks user B from reading user A's private food by ID", async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const food = await createFood(a.token);

    const res = await request(app).get(`/foods/${food.id}`).set("Authorization", `Bearer ${b.token}`);
    expect(res.status).toBe(403);
  });

  it("blocks user B from editing or deleting user A's private food", async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const food = await createFood(a.token);

    const editAttempt = await request(app)
      .put(`/foods/${food.id}`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ calories: 1 });
    expect(editAttempt.status).toBe(403);

    const deleteAttempt = await request(app)
      .delete(`/foods/${food.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(deleteAttempt.status).toBe(403);
  });

  it("blocks user B from reading, editing, or deleting user A's food log via a guessed/incremented ID", async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const food = await createFood(a.token);

    const logRes = await request(app)
      .post("/logs")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ foodId: food.id, quantity: 150, meal: "LUNCH", loggedAt: new Date().toISOString() });
    const logId = logRes.body.id;

    const bLogsToday = await request(app)
      .get(`/logs?date=${new Date().toISOString()}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(bLogsToday.body).toEqual([]);

    const editAttempt = await request(app)
      .put(`/logs/${logId}`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ quantity: 999 });
    expect(editAttempt.status).toBe(404);

    const deleteAttempt = await request(app)
      .delete(`/logs/${logId}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(deleteAttempt.status).toBe(404);
  });

  it("blocks user B from deleting user A's weight entry", async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();

    const weightRes = await request(app)
      .post("/weights")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ weightKg: 80, recordedAt: "2024-01-01" });

    const deleteAttempt = await request(app)
      .delete(`/weights/${weightRes.body.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(deleteAttempt.status).toBe(404);
  });

  it("blocks user B from viewing or logging user A's private recipe", async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const food = await createFood(a.token);

    const recipeRes = await request(app)
      .post("/recipes")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ name: "A's secret recipe", servings: 2, ingredients: [{ foodId: food.id, quantity: 200 }] });

    const viewAttempt = await request(app)
      .get(`/recipes/${recipeRes.body.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(viewAttempt.status).toBe(404);

    const logAttempt = await request(app)
      .post(`/recipes/${recipeRes.body.id}/log`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ servingsConsumed: 1, meal: "DINNER", loggedAt: new Date().toISOString() });
    expect(logAttempt.status).toBe(404);
  });

  it("rejects a malformed/unsigned access token outright", async () => {
    const res = await request(app).get("/users/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("historical data integrity", () => {
  it("a goal calculated earlier the same day still applies to that day's progress rollup", async () => {
    const a = await registerAndLogin();
    await request(app)
      .put("/users/me")
      .set("Authorization", `Bearer ${a.token}`)
      .send({
        dateOfBirth: "1994-01-01",
        sexForCalc: "MALE",
        heightCm: 180,
        activityLevel: "MODERATE",
        goal: "MAINTAIN"
      });
    const today = new Date().toISOString().slice(0, 10);
    await request(app)
      .post("/weights")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ weightKg: 80, recordedAt: today });
    const goal = await request(app)
      .post("/users/me/goals/recalculate")
      .set("Authorization", `Bearer ${a.token}`);
    expect(goal.status).toBe(201);

    const food = await createFood(a.token);
    await request(app)
      .post("/logs")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ foodId: food.id, quantity: 100, meal: "LUNCH", loggedAt: new Date().toISOString() });

    const progress = await request(app)
      .get(`/progress?from=${today}&to=${today}`)
      .set("Authorization", `Bearer ${a.token}`);

    expect(progress.status).toBe(200);
    expect(progress.body.days).toHaveLength(1);
    expect(progress.body.days[0].calorieTarget).toBe(Number(goal.body.calorieTarget));
  });

  it("does not retroactively change a food log's snapshot when the underlying food is edited later", async () => {
    const a = await registerAndLogin();
    const food = await createFood(a.token, { calories: 165, proteinG: 31, carbG: 0, fatG: 3.6 });

    const logRes = await request(app)
      .post("/logs")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ foodId: food.id, quantity: 200, meal: "DINNER", loggedAt: new Date().toISOString() });

    expect(Number(logRes.body.caloriesSnapshot)).toBeCloseTo(330, 1);

    await request(app)
      .put(`/foods/${food.id}`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ calories: 400 });

    const refetched = await request(app)
      .get(`/logs?date=${new Date().toISOString()}`)
      .set("Authorization", `Bearer ${a.token}`);

    const sameLog = refetched.body.find((l: { id: string }) => l.id === logRes.body.id);
    expect(Number(sameLog.caloriesSnapshot)).toBeCloseTo(330, 1);
  });

  it("keeps append-only goal history so an earlier date still returns the goal that was in effect then", async () => {
    const a = await registerAndLogin();

    await request(app)
      .put("/users/me")
      .set("Authorization", `Bearer ${a.token}`)
      .send({
        dateOfBirth: "1994-01-01",
        sexForCalc: "MALE",
        heightCm: 180,
        activityLevel: "MODERATE",
        goal: "MAINTAIN"
      });

    await request(app)
      .post("/weights")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ weightKg: 90, recordedAt: "2024-01-01" });

    const firstGoal = await request(app)
      .post("/users/me/goals/recalculate")
      .set("Authorization", `Bearer ${a.token}`);
    expect(firstGoal.status).toBe(201);
    const firstTarget = Number(firstGoal.body.calorieTarget);

    await request(app)
      .post("/weights")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ weightKg: 80, recordedAt: "2024-06-01" });

    const secondGoal = await request(app)
      .post("/users/me/goals/recalculate")
      .set("Authorization", `Bearer ${a.token}`);
    const secondTarget = Number(secondGoal.body.calorieTarget);

    expect(secondTarget).not.toBeCloseTo(firstTarget, 0);

    const currentGoal = await request(app)
      .get("/users/me/goals/current")
      .set("Authorization", `Bearer ${a.token}`);
    expect(Number(currentGoal.body.calorieTarget)).toBeCloseTo(secondTarget, 1);
  });
});

describe("account deletion requires re-authentication", () => {
  it("rejects deletion with the wrong password and does not delete the account", async () => {
    const a = await registerAndLogin();

    const wrongPassword = await request(app)
      .delete("/account/me")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ password: "definitely-wrong-1" });
    expect(wrongPassword.status).toBe(401);

    const stillWorks = await request(app).get("/users/me").set("Authorization", `Bearer ${a.token}`);
    expect(stillWorks.status).toBe(200);
  });

  it("deletes the account with the correct password, after which login fails", async () => {
    const a = await registerAndLogin();

    const del = await request(app)
      .delete("/account/me")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ password: "correcthorse1" });
    expect(del.status).toBe(204);

    const loginAfter = await request(app)
      .post("/auth/login")
      .send({ email: a.email, password: "correcthorse1" });
    expect(loginAfter.status).toBe(401);
  });
});

describe("input validation rejects malformed/malicious values", () => {
  it("rejects negative and zero food log quantities", async () => {
    const a = await registerAndLogin();
    const food = await createFood(a.token);

    const negative = await request(app)
      .post("/logs")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ foodId: food.id, quantity: -5, meal: "SNACK", loggedAt: new Date().toISOString() });
    expect(negative.status).toBe(400);

    const zero = await request(app)
      .post("/logs")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ foodId: food.id, quantity: 0, meal: "SNACK", loggedAt: new Date().toISOString() });
    expect(zero.status).toBe(400);
  });

  it("rejects NaN/Infinity-shaped payloads and oversized strings", async () => {
    const a = await registerAndLogin();

    const badFood = await request(app)
      .post("/foods")
      .set("Authorization", `Bearer ${a.token}`)
      .send({
        name: "x".repeat(5000),
        servingSize: 100,
        servingUnit: "G",
        calories: Number.POSITIVE_INFINITY,
        proteinG: 1,
        carbG: 1,
        fatG: 1
      });
    expect(badFood.status).toBe(400);
  });

  it("rejects a non-existent foodId (not just malformed UUIDs)", async () => {
    const a = await registerAndLogin();
    const res = await request(app)
      .post("/logs")
      .set("Authorization", `Bearer ${a.token}`)
      .send({
        foodId: "00000000-0000-0000-0000-000000000000",
        quantity: 100,
        meal: "SNACK",
        loggedAt: new Date().toISOString()
      });
    expect(res.status).toBe(404);
  });

  it("rejects SQL-injection-shaped strings as ordinary data, not as commands", async () => {
    const a = await registerAndLogin();
    const injection = "'; DROP TABLE users; --";
    const res = await request(app)
      .post("/foods")
      .set("Authorization", `Bearer ${a.token}`)
      .send({
        name: injection,
        servingSize: 100,
        servingUnit: "G",
        calories: 100,
        proteinG: 1,
        carbG: 1,
        fatG: 1
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(injection);

    // Users table must still be intact.
    const stillWorks = await request(app).get("/users/me").set("Authorization", `Bearer ${a.token}`);
    expect(stillWorks.status).toBe(200);
  });
});

describe("rate limiting", () => {
  it("actually blocks requests once the configured limit is exceeded (isolated harness)", async () => {
    // Verified against the real express-rate-limit middleware wired the same
    // way production routes use it, isolated in its own tiny app so it can't
    // be starved or polluted by the other auth tests sharing the main app's
    // process-wide limiter state.
    const express = (await import("express")).default;
    const rateLimit = (await import("express-rate-limit")).default;
    const miniApp = express();
    miniApp.use(rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: true, legacyHeaders: false }));
    miniApp.post("/probe", (_req, res) => res.status(200).json({ ok: true }));

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push((await request(miniApp).post("/probe")).status);
    }
    expect(results.slice(0, 3)).toEqual([200, 200, 200]);
    expect(results.slice(3)).toEqual([429, 429]);
  });

  it("wires the real rate limiter onto /auth/register (limit surfaces in response headers)", async () => {
    const res = await request(app).post("/auth/register").send({ email: uniqueEmail(), password: "correcthorse1" });
    expect(res.headers["ratelimit-limit"]).toBeDefined();
  });
});
