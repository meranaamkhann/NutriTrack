import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { truncateAll, closeDb } from "./helpers/db.js";
import { bearer, createFood, registerAndLogin } from "./helpers/api.js";

const app = buildApp();
const today = () => new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  await truncateAll();
});
afterAll(async () => {
  await closeDb();
});

async function makeRecipe(token: string, foodId: string) {
  const res = await request(app)
    .post("/recipes")
    .set(bearer(token))
    .send({ name: "Pilaf", servings: 2, ingredients: [{ foodId, quantity: 200 }] });
  return res.body as { id: string };
}

describe("diary: one place for everything eaten that day", () => {
  it("shows a logged recipe alongside foods, with correct per-serving maths (was invisible on Today)", async () => {
    const { token } = await registerAndLogin(app);
    const food = await createFood(app, token);
    const recipe = await makeRecipe(token, food.id);
    const now = new Date().toISOString();

    await request(app).post("/logs").set(bearer(token)).send({ foodId: food.id, quantity: 50, meal: "BREAKFAST", loggedAt: now });
    const logged = await request(app)
      .post(`/recipes/${recipe.id}/log`)
      .set(bearer(token))
      .send({ servingsConsumed: 1.5, meal: "LUNCH", loggedAt: now, loggedDate: today() });
    expect(logged.status).toBe(201);

    const diary = await request(app).get(`/diary?date=${today()}`).set(bearer(token));
    expect(diary.status).toBe(200);
    expect(diary.body.entries).toHaveLength(2);

    const recipeEntry = diary.body.entries.find((e: { kind: string }) => e.kind === "RECIPE");
    // 200g of a 200kcal/100g food = 400kcal over 2 servings = 200kcal/serving; x1.5 = 300
    expect(recipeEntry.calories).toBeCloseTo(300, 1);
    expect(recipeEntry.unit).toBe("SERVING");
    const foodEntry = diary.body.entries.find((e: { kind: string }) => e.kind === "FOOD");
    expect(foodEntry.calories).toBeCloseTo(100, 1);
    expect(foodEntry.unit).toBe("G");
  });

  it("can log to and read back a specific past day, and keeps days separate", async () => {
    const { token } = await registerAndLogin(app);
    const food = await createFood(app, token);

    const res = await request(app)
      .post("/logs")
      .set(bearer(token))
      .send({ foodId: food.id, quantity: 100, meal: "DINNER", loggedAt: new Date().toISOString(), loggedDate: "2026-01-15" });
    expect(res.status).toBe(201);

    const onDay = await request(app).get("/diary?date=2026-01-15").set(bearer(token));
    const nextDay = await request(app).get("/diary?date=2026-01-16").set(bearer(token));
    expect(onDay.body.entries).toHaveLength(1);
    expect(nextDay.body.entries).toHaveLength(0);
  });

  it("rejects impossible or far-future dates", async () => {
    const { token } = await registerAndLogin(app);
    const food = await createFood(app, token);
    const base = { foodId: food.id, quantity: 100, meal: "SNACK", loggedAt: new Date().toISOString() };

    const notReal = await request(app).post("/logs").set(bearer(token)).send({ ...base, loggedDate: "2026-02-31" });
    const farFuture = await request(app).post("/logs").set(bearer(token)).send({ ...base, loggedDate: "2099-01-01" });
    const badQuery = await request(app).get("/diary?date=yesterday").set(bearer(token));
    expect(notReal.status).toBe(400);
    expect(farFuture.status).toBe(400);
    expect(badQuery.status).toBe(400);
  });

  it("edits a recipe entry's servings from its own snapshot, and deletes it", async () => {
    const { token } = await registerAndLogin(app);
    const food = await createFood(app, token);
    const recipe = await makeRecipe(token, food.id);
    const logged = await request(app)
      .post(`/recipes/${recipe.id}/log`)
      .set(bearer(token))
      .send({ servingsConsumed: 1, meal: "DINNER", loggedAt: new Date().toISOString(), loggedDate: today() });

    const edited = await request(app)
      .put(`/diary/recipe-logs/${logged.body.id}`)
      .set(bearer(token))
      .send({ servingsConsumed: 3 });
    expect(edited.status).toBe(200);
    expect(Number(edited.body.caloriesSnapshot)).toBeCloseTo(600, 1);

    const removed = await request(app).delete(`/diary/recipe-logs/${logged.body.id}`).set(bearer(token));
    expect(removed.status).toBe(204);
    const diary = await request(app).get(`/diary?date=${today()}`).set(bearer(token));
    expect(diary.body.entries).toHaveLength(0);
  });

  it("keeps one user's diary and recipe entries private from another", async () => {
    const a = await registerAndLogin(app);
    const b = await registerAndLogin(app);
    const food = await createFood(app, a.token);
    const recipe = await makeRecipe(a.token, food.id);
    const logged = await request(app)
      .post(`/recipes/${recipe.id}/log`)
      .set(bearer(a.token))
      .send({ servingsConsumed: 1, meal: "LUNCH", loggedAt: new Date().toISOString(), loggedDate: today() });

    const bDiary = await request(app).get(`/diary?date=${today()}`).set(bearer(b.token));
    expect(bDiary.body.entries).toEqual([]);
    const bEdit = await request(app).put(`/diary/recipe-logs/${logged.body.id}`).set(bearer(b.token)).send({ servingsConsumed: 9 });
    const bDelete = await request(app).delete(`/diary/recipe-logs/${logged.body.id}`).set(bearer(b.token));
    expect(bEdit.status).toBe(404);
    expect(bDelete.status).toBe(404);
  });

  it("returns recently logged foods once each, newest first", async () => {
    const { token } = await registerAndLogin(app);
    const a = await createFood(app, token, { name: "Alpha" });
    const b = await createFood(app, token, { name: "Beta" });
    const at = (ms: number) => new Date(Date.now() - ms).toISOString();
    const log = (foodId: string, ms: number, qty: number) =>
      request(app).post("/logs").set(bearer(token)).send({ foodId, quantity: qty, meal: "SNACK", loggedAt: at(ms) });

    await log(a.id, 30000, 10);
    await log(b.id, 20000, 11);
    await log(a.id, 10000, 12);

    const recent = await request(app).get("/foods/recent").set(bearer(token));
    expect(recent.body.map((f: { name: string }) => f.name)).toEqual(["Alpha", "Beta"]);
  });
});

describe("targets: set up, preview, set manually", () => {
  const setupBody = {
    displayName: "Asad",
    dateOfBirth: "1998-04-12",
    sexForCalc: "MALE",
    heightCm: 178,
    weightKg: 80,
    activityLevel: "MODERATE",
    goal: "LOSE",
    unitPref: "METRIC",
    timezone: "Asia/Kolkata"
  };

  it("sets up profile, first weight and first target in one call, and the diary shows that target", async () => {
    const { token } = await registerAndLogin(app);
    const res = await request(app).post("/users/me/setup").set(bearer(token)).send(setupBody);
    expect(res.status).toBe(201);
    expect(res.body.goal.source).toBe("CALCULATED");
    expect(Number(res.body.goal.calorieTarget)).toBeGreaterThan(1200);
    expect(res.body.profile.displayName).toBe("Asad");

    const weights = await request(app).get("/weights").set(bearer(token));
    expect(weights.body).toHaveLength(1);

    const diary = await request(app).get(`/diary?date=${today()}`).set(bearer(token));
    expect(diary.body.goal.calorieTarget).toBeCloseTo(Number(res.body.goal.calorieTarget), 1);
  });

  it("writes nothing at all when the setup details are invalid", async () => {
    const { token } = await registerAndLogin(app);
    const res = await request(app)
      .post("/users/me/setup")
      .set(bearer(token))
      .send({ ...setupBody, dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/age/i);

    const weights = await request(app).get("/weights").set(bearer(token));
    const goal = await request(app).get("/users/me/goals/current").set(bearer(token));
    expect(weights.body).toHaveLength(0);
    expect(goal.body).toBeNull();
  });

  it("previews a target without saving anything", async () => {
    const { token } = await registerAndLogin(app);
    const res = await request(app).post("/users/me/goals/preview").set(bearer(token)).send(setupBody);
    expect(res.status).toBe(200);
    expect(res.body.calorieTarget).toBeGreaterThan(1200);
    const goal = await request(app).get("/users/me/goals/current").set(bearer(token));
    expect(goal.body).toBeNull();
  });

  it("lets you set your own target, splitting macros automatically or using yours", async () => {
    const { token } = await registerAndLogin(app);
    const auto = await request(app).post("/users/me/goals/manual").set(bearer(token)).send({ calorieTarget: 2000 });
    expect(auto.status).toBe(201);
    expect(auto.body.source).toBe("MANUAL");
    expect(Number(auto.body.proteinGTarget)).toBeCloseTo(150, 1);
    expect(Number(auto.body.carbGTarget)).toBeCloseTo(200, 1);

    const custom = await request(app)
      .post("/users/me/goals/manual")
      .set(bearer(token))
      .send({ calorieTarget: 2200, proteinG: 180, carbG: 200, fatG: 70 });
    expect(Number(custom.body.proteinGTarget)).toBe(180);

    const history = await request(app).get("/users/me/goals/history").set(bearer(token));
    expect(history.body).toHaveLength(2);
    expect(history.body[0].source).toBe("MANUAL");
  });

  it("rejects unsafe or half-specified manual targets", async () => {
    const { token } = await registerAndLogin(app);
    const tooLow = await request(app).post("/users/me/goals/manual").set(bearer(token)).send({ calorieTarget: 500 });
    const halfMacros = await request(app).post("/users/me/goals/manual").set(bearer(token)).send({ calorieTarget: 2000, proteinG: 100 });
    expect(tooLow.status).toBe(400);
    expect(halfMacros.status).toBe(400);
  });

  it("shows days from before the first target with that first target instead of an empty ring", async () => {
    const { token } = await registerAndLogin(app);
    await request(app).post("/users/me/goals/manual").set(bearer(token)).send({ calorieTarget: 1800 });
    const old = await request(app).get("/diary?date=2026-01-02").set(bearer(token));
    expect(old.body.goal.calorieTarget).toBe(1800);
  });
});

describe("a server that has been running for days still accepts new logs", () => {
  it("does not freeze the 'not in the future' limit at server start", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3 * 24 * 3600 * 1000);
    try {
      const { token } = await registerAndLogin(app);
      const food = await createFood(app, token);
      const res = await request(app)
        .post("/logs")
        .set(bearer(token))
        .send({ foodId: food.id, quantity: 100, meal: "SNACK", loggedAt: new Date().toISOString() });
      expect(res.status).toBe(201);
    } finally {
      vi.useRealTimers();
    }
  });
});
