import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./profile.service.js";

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await service.getOrCreateProfile(req.user!.id);
  res.status(200).json(profile);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const profile = await service.updateProfile(req.user!.id, req.body);
  res.status(200).json(profile);
});

export const recalculateGoals = asyncHandler(async (req, res) => {
  const goals = await service.recalculateGoals(req.user!.id);
  res.status(201).json(goals);
});

export const getCurrentGoals = asyncHandler(async (req, res) => {
  const goals = await service.getCurrentGoals(req.user!.id);
  res.status(200).json(goals);
});

export const getGoalsForDate = asyncHandler(async (req, res) => {
  const { date } = req.query as unknown as { date: Date };
  const goals = await service.getGoalsForDate(req.user!.id, date);
  res.status(200).json(goals);
});
