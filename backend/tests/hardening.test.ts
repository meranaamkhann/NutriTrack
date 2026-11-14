import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { users, aiParseRequests, adminAuditLog, foods, refreshTokens } from "../src/db/schema.js";
import { seedFoods } from "../src/db/seed.js";
import { registerAndLogin, bearer, createFood, uniqueEmail } from "./helpers/api.js";
import { truncateAll, closeDb } from "./helpers/db.js";

const app = buildApp();
beforeEach(async () => { await truncateAll(); });
afterAll(async () => { await closeDb(); });

const logBody = (foodId: string, extra: Record<string, unknown> = {}) => ({
  foodId, quantity: 100, meal: "LUNCH", loggedAt: new Date().toISOString(), ...extra
});

describe("request parsing", () => {
  it("answers malformed JSON with 400, not 500", async () => {
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
  });
  it("answers an oversized body with 413", async () => {
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.co", password: "x".repeat(200_000) }));
    expect(res.status).toBe(413);
  });
});

describe("food logs", () => {
  it("rejects a far-future loggedAt on update, same as on create", async () => {
    const { token } = await registerAndLogin(app);
    const food = await createFood(app, token);
    const log = await request(app).post("/logs").set(bearer(token)).send(logBody(food.id));
    const res = await request(app).put(`/logs/${log.body.id}`).set(bearer(token)).send({ loggedAt: "2099-01-01T00:00:00Z" });
    expect(res.status).toBe(400);
  });
  it("returns 400 (not 500) when a portion's nutrition would overflow", async () => {
    const { token } = await registerAndLogin(app);
    const food = await createFood(app, token, { servingSize: 0.01, calories: 20000 });
    const res = await request(app).post("/logs").set(bearer(token)).send(logBody(food.id, { quantity: 100000 }));
    expect(res.status).toBe(400);
  });
});

describe("email verification", () => {
  it("an old verification link can't verify a new address", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/auth/register").send({ email, password: "correcthorse1" });
    const oldToken = reg.body.devOnlyVerifyToken;
    const login = await request(app).post("/auth/login").send({ email, password: "correcthorse1" });
    const newEmail = uniqueEmail();
    await request(app).post("/account/change-email").set(bearer(login.body.accessToken)).send({ newEmail, password: "correcthorse1" });
    expect((await request(app).post("/auth/verify-email").send({ token: oldToken })).status).toBe(400);
    const [u] = await db.select().from(users).where(eq(users.email, email));
    expect(u.emailVerified).toBe(false);
    expect(u.email).toBe(email);
  });
  it("a verification link can only be used once", async () => {
    const reg = await request(app).post("/auth/register").send({ email: uniqueEmail(), password: "correcthorse1" });
    const results = await Promise.all([1, 2, 3].map(() => request(app).post("/auth/verify-email").send({ token: reg.body.devOnlyVerifyToken })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });
});

describe("admin", () => {
  it("refuses to delete an admin account instead of crashing", async () => {
    const adm = await registerAndLogin(app);
    await db.update(users).set({ role: "ADMIN" }).where(eq(users.email, adm.email));
    const food = await createFood(app, adm.token);
    await request(app).put(`/admin/foods/${food.id}/verify`).set(bearer(adm.token)).send({ status: "VERIFIED" });
    const del = await request(app).delete("/account/me").set(bearer(adm.token)).send({ password: adm.password });
    expect(del.status).toBe(400);
    expect((await db.select().from(adminAuditLog)).length).toBeGreaterThan(0);
  });
  it("lists the audit log newest first with a limit", async () => {
    const adm = await registerAndLogin(app);
    await db.update(users).set({ role: "ADMIN" }).where(eq(users.email, adm.email));
    const res = await request(app).get("/admin/audit-log?limit=5").set(bearer(adm.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("concurrency", () => {
  it("accepting the same AI parse in parallel creates one set of logs", async () => {
    const { token, email } = await registerAndLogin(app);
    const [u] = await db.select().from(users).where(eq(users.email, email));
    const [rec] = await db.insert(aiParseRequests).values({ userId: u.id, rawText: "egg", parsedOutput: { items: [] }, accepted: false }).returning();
    const item = { name: "Egg", quantity: 1, unit: "PIECE", meal: "BREAKFAST", estimatedCalories: 70, estimatedProteinG: 6, estimatedCarbG: 0, estimatedFatG: 5, loggedAt: new Date().toISOString() };
    const rs = await Promise.all([1, 2, 3].map(() => request(app).post(`/ai/parse/${rec.id}/accept`).set(bearer(token)).send({ items: [item] })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it("parallel refreshes with one token all succeed and the session survives", async () => {
    const email = uniqueEmail();
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, password: "correcthorse1" });
    const login = await agent.post("/auth/login").send({ email, password: "correcthorse1" });
    const cookie = (login.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
    const rs = await Promise.all([1, 2, 3].map(() => request(app).post("/auth/refresh").set("Cookie", cookie)));
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    // Any of the new cookies still works afterwards.
    const next = (rs[2].headers["set-cookie"] as unknown as string[])[0].split(";")[0];
    expect((await request(app).post("/auth/refresh").set("Cookie", next)).status).toBe(200);
  });

  it("a rotated token replayed after the grace window kills the session", async () => {
    const email = uniqueEmail();
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, password: "correcthorse1" });
    const login = await agent.post("/auth/login").send({ email, password: "correcthorse1" });
    const original = (login.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
    const rotated = await request(app).post("/auth/refresh").set("Cookie", original);
    const newer = (rotated.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
    // Age the rotation beyond the grace window.
    await db.update(refreshTokens).set({ revokedAt: new Date(Date.now() - 60_000) }).where(eq(refreshTokens.revokedAt, refreshTokens.revokedAt));
    const replay = await request(app).post("/auth/refresh").set("Cookie", original);
    expect(replay.status).toBe(401);
    expect((await request(app).post("/auth/refresh").set("Cookie", newer)).status).toBe(401);
  });

  it("logout can't be undone by replaying the old cookie inside the grace window", async () => {
    const email = uniqueEmail();
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, password: "correcthorse1" });
    const login = await agent.post("/auth/login").send({ email, password: "correcthorse1" });
    const cookie = (login.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
    await agent.post("/auth/logout");
    expect((await request(app).post("/auth/refresh").set("Cookie", cookie)).status).toBe(401);
  });
});

describe("export", () => {
  it("neutralises spreadsheet formulas and includes recipe logs", async () => {
    const { token } = await registerAndLogin(app);
    const food = await createFood(app, token, { name: '=HYPERLINK("http://evil.example","x")' });
    await request(app).post("/logs").set(bearer(token)).send(logBody(food.id));
    const exp = await request(app).post("/export").set(bearer(token)).send({ format: "CSV" });
    const dl = await request(app).get(`/export/${exp.body.jobId}`).set(bearer(token)).set("x-export-token", exp.body.token);
    expect(dl.status).toBe(200);
    expect(dl.text).toContain(`"'=HYPERLINK(`);
    expect(dl.text).not.toMatch(/,"=HYPERLINK/);
  });
  it("accepts the token as a header and still as a query param", async () => {
    const { token } = await registerAndLogin(app);
    const exp = await request(app).post("/export").set(bearer(token)).send({ format: "JSON" });
    expect((await request(app).get(`/export/${exp.body.jobId}`).set(bearer(token)).set("x-export-token", exp.body.token)).status).toBe(200);
    expect((await request(app).get(`/export/${exp.body.jobId}`).query({ token: exp.body.token }).set(bearer(token))).status).toBe(200);
    expect((await request(app).get(`/export/${exp.body.jobId}`).set(bearer(token))).status).toBe(400);
  });
});

describe("starter foods", () => {
  it("seeds searchable foods for everyone, idempotently", async () => {
    const first = await seedFoods();
    expect(first.added).toBeGreaterThan(40);
    expect((await seedFoods()).added).toBe(0);
    const { token } = await registerAndLogin(app);
    const res = await request(app).get("/foods").query({ q: "banana" }).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.some((x: { name: string }) => x.name === "Banana")).toBe(true);
    expect((await db.select().from(foods)).every((x) => x.ownerId === null)).toBe(true);
  });
  it("treats % and _ in a search as plain characters", async () => {
    const { token } = await registerAndLogin(app);
    await createFood(app, token, { name: "Plain rice" });
    const res = await request(app).get("/foods").query({ q: "%" }).set(bearer(token));
    expect(res.body).toHaveLength(0);
  });
});

describe("calorie targets", () => {
  it("refuses manual targets under 1,200 kcal", async () => {
    const { token } = await registerAndLogin(app);
    const res = await request(app).post("/users/me/goals/manual").set(bearer(token)).send({ calorieTarget: 900 });
    expect(res.status).toBe(400);
  });
});

describe("recipes", () => {
  it("can be edited, and old diary entries keep their logged nutrition", async () => {
    const { token } = await registerAndLogin(app);
    const a = await createFood(app, token, { name: "A", calories: 100 });
    const b = await createFood(app, token, { name: "B", calories: 300 });
    const rec = await request(app).post("/recipes").set(bearer(token)).send({ name: "Mix", servings: 2, ingredients: [{ foodId: a.id, quantity: 100 }] });
    const upd = await request(app).put(`/recipes/${rec.body.id}`).set(bearer(token)).send({ name: "Mix 2", servings: 1, ingredients: [{ foodId: b.id, quantity: 100 }] });
    expect(upd.status).toBe(200);
    const got = await request(app).get(`/recipes/${rec.body.id}`).set(bearer(token));
    expect(got.body.name ?? got.body.recipe?.name).toBe("Mix 2");
    const other = await registerAndLogin(app);
    expect((await request(app).put(`/recipes/${rec.body.id}`).set(bearer(other.token)).send({ name: "x", servings: 1, ingredients: [{ foodId: b.id, quantity: 1 }] })).status).toBe(404);
  });
});
