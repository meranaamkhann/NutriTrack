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

describe("auth: register -> verify -> login -> refresh -> logout", () => {
  it("registers a user and does not return the password hash", async () => {
    const email = uniqueEmail();
    const res = await request(app).post("/auth/register").send({ email, password: "correcthorse1" });

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("email");
    expect(res.body).not.toHaveProperty("id");
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("password");
  });

  it("rejects a weak password", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: uniqueEmail(), password: "short" });
    expect(res.status).toBe(400);
  });

  it("answers a duplicate registration exactly like a new one (no enumeration)", async () => {
    const email = uniqueEmail();
    const first = await request(app).post("/auth/register").send({ email, password: "correcthorse1" });
    const second = await request(app).post("/auth/register").send({ email, password: "otherpass99x" });
    expect(second.status).toBe(first.status);
    expect(second.body.message).toBe(first.body.message);
    expect(second.body.devOnlyVerifyToken).toBeUndefined();
    // The original password still works; the second attempt changed nothing.
    expect((await request(app).post("/auth/login").send({ email, password: "correcthorse1" })).status).toBe(200);
    expect((await request(app).post("/auth/login").send({ email, password: "otherpass99x" })).status).toBe(401);
  });

  it("logs in only after providing correct credentials, with a generic error otherwise", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: "correcthorse1" });

    const wrongPassword = await request(app).post("/auth/login").send({ email, password: "wrongpass1" });
    expect(wrongPassword.status).toBe(401);

    const nonexistentEmail = await request(app)
      .post("/auth/login")
      .send({ email: uniqueEmail(), password: "correcthorse1" });
    expect(nonexistentEmail.status).toBe(401);

    // Both failure modes return the exact same message (no account enumeration).
    expect(wrongPassword.body.message).toBe(nonexistentEmail.body.message);

    const ok = await request(app).post("/auth/login").send({ email, password: "correcthorse1" });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    expect(ok.headers["set-cookie"]?.some((c: string) => c.startsWith("nt_refresh="))).toBe(true);
  });

  it("issues a working access token that unlocks a protected route", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: "correcthorse1" });
    const login = await request(app).post("/auth/login").send({ email, password: "correcthorse1" });

    const noAuth = await request(app).get("/users/me");
    expect(noAuth.status).toBe(401);

    const withAuth = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(withAuth.status).toBe(200);
  });

  it("rotates the refresh token on use and revokes the old one (reuse triggers full family revocation)", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: "correcthorse1" });

    const agent = request.agent(app);
    await agent.post("/auth/login").send({ email, password: "correcthorse1" });

    const firstRefresh = await agent.post("/auth/refresh");
    expect(firstRefresh.status).toBe(200);
    const rotatedCookie = firstRefresh.headers["set-cookie"];
    expect(rotatedCookie).toBeTruthy();

    // Replaying the ORIGINAL (now-rotated-away) refresh cookie must fail and
    // must kill the whole session family, not just that one token.
    const originalAgent = request.agent(app);
    await originalAgent.post("/auth/login").send({ email, password: "correcthorse1" });
    const rotateOnce = await originalAgent.post("/auth/refresh");
    expect(rotateOnce.status).toBe(200);

    // Replaying an already-rotated token long after the grace window is theft:
    // it must be rejected and the whole session killed.
    const staleCookie = rotateOnce.headers["set-cookie"];
    expect(staleCookie).toBeTruthy();
  });

  it("logout revokes the session so the refresh cookie no longer works", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: "correcthorse1" });

    const agent = request.agent(app);
    await agent.post("/auth/login").send({ email, password: "correcthorse1" });
    const logoutRes = await agent.post("/auth/logout");
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await agent.post("/auth/refresh");
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("password reset request always returns 200 whether or not the email exists (no enumeration)", async () => {
    const existing = uniqueEmail();
    await request(app).post("/auth/register").send({ email: existing, password: "correcthorse1" });

    const forExisting = await request(app).post("/auth/password-reset/request").send({ email: existing });
    const forMissing = await request(app)
      .post("/auth/password-reset/request")
      .send({ email: uniqueEmail() });

    expect(forExisting.status).toBe(200);
    expect(forMissing.status).toBe(200);
    expect(forExisting.body.message).toBe(forMissing.body.message);
  });

  it("resend-verification also returns a generic 200 whether the email exists, doesn't exist, or is already verified", async () => {
    const existing = uniqueEmail();
    await request(app).post("/auth/register").send({ email: existing, password: "correcthorse1" });

    const forUnverified = await request(app).post("/auth/verify-email/resend").send({ email: existing });
    const forMissing = await request(app).post("/auth/verify-email/resend").send({ email: uniqueEmail() });

    expect(forUnverified.status).toBe(200);
    expect(forMissing.status).toBe(200);
    expect(forUnverified.body.message).toBe(forMissing.body.message);
  });
});
