import request from "supertest";
import type { Express } from "express";

export function uniqueEmail() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
}

export async function registerAndLogin(app: Express, password = "correcthorse1") {
  const email = uniqueEmail();
  await request(app).post("/auth/register").send({ email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  return { email, token: login.body.accessToken as string, password };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createFood(app: Express, token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/foods")
    .set(bearer(token))
    .send({ name: "Test Food", servingSize: 100, servingUnit: "G", calories: 200, proteinG: 10, carbG: 20, fatG: 5, ...overrides });
  return res.body as { id: string };
}
