import { eq } from "drizzle-orm";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { db } from "../../db/client.js";
import { profiles } from "../../db/schema.js";
import * as service from "./logs.service.js";

export const createLog = asyncHandler(async (req, res) => {
  const log = await service.createFoodLog(req.user!.id, req.body);
  res.status(201).json(log);
});

export const updateLog = asyncHandler(async (req, res) => {
  const log = await service.updateFoodLog(req.user!.id, req.params.id, req.body);
  res.status(200).json(log);
});

export const deleteLog = asyncHandler(async (req, res) => {
  await service.deleteFoodLog(req.user!.id, req.params.id);
  res.status(204).send();
});

export const listLogsForDate = asyncHandler(async (req, res) => {
  const { date } = req.query as unknown as { date: Date };
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, req.user!.id)).limit(1);
  const logs = await service.listLogsForDate(req.user!.id, date, profile?.timezone ?? "UTC");
  res.status(200).json(logs);
});
