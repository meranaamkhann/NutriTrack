import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { truncateAll, closeDb } from "./helpers/db.js";
import { bearer, registerAndLogin, uniqueEmail } from "./helpers/api.js";

const app = buildApp();

beforeEach(async () => {
  await truncateAll();
});
afterAll(async () => {
  await closeDb();
});

async function loginOn(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post("/auth/login").send({ email, password });
  return { agent, token: res.body.accessToken as string };
}

describe("account info", () => {
  it("returns the signed-in account without any secrets", async () => {
    const { token, email } = await registerAndLogin(app);
    const res = await request(app).get("/account/me").set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
    expect(res.body.emailVerified).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash/);
  });
});

describe("change password", () => {
  it("rejects a wrong current password with 403 (not 401, which would look like an expired session)", async () => {
    const { token } = await registerAndLogin(app);
    const res = await request(app)
      .post("/account/change-password")
      .set(bearer(token))
      .send({ currentPassword: "not-my-password1", newPassword: "brandnewpass22" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("INVALID_PASSWORD");
  });

  it("rejects a weak new password and one identical to the current", async () => {
    const { token, password } = await registerAndLogin(app);
    const weak = await request(app).post("/account/change-password").set(bearer(token)).send({ currentPassword: password, newPassword: "short1" });
    const same = await request(app).post("/account/change-password").set(bearer(token)).send({ currentPassword: password, newPassword: password });
    expect(weak.status).toBe(400);
    expect(same.status).toBe(400);
  });

  it("switches the password, signs out OTHER devices, and keeps this one signed in", async () => {
    const { email, password } = await registerAndLogin(app);
    const thisDevice = await loginOn(email, password);
    const otherDevice = await loginOn(email, password);

    const res = await request(app)
      .post("/account/change-password")
      .set(bearer(thisDevice.token))
      .send({ currentPassword: password, newPassword: "brandnewpass22" });
    expect(res.status).toBe(200);

    expect((await otherDevice.agent.post("/auth/refresh")).status).toBe(401);
    expect((await thisDevice.agent.post("/auth/refresh")).status).toBe(200);

    expect((await request(app).post("/auth/login").send({ email, password })).status).toBe(401);
    expect((await request(app).post("/auth/login").send({ email, password: "brandnewpass22" })).status).toBe(200);
  });
});

describe("change email", () => {
  it("needs the password, refuses an address already in use, and resets verification on success", async () => {
    const a = await registerAndLogin(app);
    const b = await registerAndLogin(app);
    const fresh = uniqueEmail();

    const wrongPw = await request(app).post("/account/change-email").set(bearer(a.token)).send({ newEmail: fresh, password: "nope-nope-1" });
    const taken = await request(app).post("/account/change-email").set(bearer(a.token)).send({ newEmail: b.email, password: a.password });
    expect(wrongPw.status).toBe(403);
    expect(taken.status).toBe(409);

    const ok = await request(app).post("/account/change-email").set(bearer(a.token)).send({ newEmail: fresh, password: a.password });
    expect(ok.status).toBe(200);
    expect(ok.body.email).toBe(fresh);
    expect(ok.body.emailVerified).toBe(false);

    expect((await request(app).post("/auth/login").send({ email: fresh, password: a.password })).status).toBe(200);
    expect((await request(app).post("/auth/login").send({ email: a.email, password: a.password })).status).toBe(401);
  });
});

describe("active sessions", () => {
  it("lists devices, marks the current one, and can sign others out", async () => {
    const { email, password } = await registerAndLogin(app);
    const here = await loginOn(email, password);
    const there = await loginOn(email, password);

    const list = await request(app).get("/account/sessions").set(bearer(here.token));
    const current = list.body.filter((s: { current: boolean }) => s.current);
    expect(current).toHaveLength(1);
    expect(list.body.length).toBeGreaterThanOrEqual(2);
    expect(list.body[0].device).toBeTruthy();

    const other = list.body.find((s: { current: boolean }) => !s.current);
    const revoke = await request(app).delete(`/account/sessions/${other.id}`).set(bearer(here.token));
    expect(revoke.status).toBe(204);

    await request(app).post("/account/sessions/revoke-others").set(bearer(here.token));
    const after = await request(app).get("/account/sessions").set(bearer(here.token));
    expect(after.body).toHaveLength(1);
    expect(after.body[0].current).toBe(true);
    expect((await there.agent.post("/auth/refresh")).status).toBe(401);
  });

  it("will not end the current session through the revoke endpoint, and can't touch another user's session", async () => {
    const a = await registerAndLogin(app);
    const b = await registerAndLogin(app);
    const aSessions = await request(app).get("/account/sessions").set(bearer(a.token));
    const own = aSessions.body[0];
    expect((await request(app).delete(`/account/sessions/${own.id}`).set(bearer(a.token))).status).toBe(400);
    expect((await request(app).delete(`/account/sessions/${own.id}`).set(bearer(b.token))).status).toBe(404);
  });
});

describe("login lockout", () => {
  it("locks after 5 wrong passwords, answers identically, then recovers", async () => {
    const { email, password } = await registerAndLogin(app);
    const attempt = (pw: string) => request(app).post("/auth/login").send({ email, password: pw });

    const firstFail = await attempt("wrong-password-1");
    for (let i = 0; i < 4; i++) await attempt("wrong-password-1");

    const lockedWithCorrect = await attempt(password);
    expect(lockedWithCorrect.status).toBe(401);
    expect(lockedWithCorrect.body.message).toBe(firstFail.body.message);

    await db.update(users).set({ lockedUntil: new Date(Date.now() - 1000), failedLoginAttempts: 0 }).where(eq(users.email, email));
    expect((await attempt(password)).status).toBe(200);
  });

  it("a successful login resets the counter, so scattered typos never lock you out", async () => {
    const { email, password } = await registerAndLogin(app);
    const attempt = (pw: string) => request(app).post("/auth/login").send({ email, password: pw });
    for (let i = 0; i < 3; i++) await attempt("wrong-password-1");
    expect((await attempt(password)).status).toBe(200);
    for (let i = 0; i < 4; i++) await attempt("wrong-password-1");
    expect((await attempt(password)).status).toBe(200);
  });
});
