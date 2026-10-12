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

export const previewGoals = asyncHandler(async (req, res) => {
  res.status(200).json(service.previewGoals(req.body));
});

export const completeSetup = asyncHandler(async (req, res) => {
  const result = await service.completeSetup(req.user!.id, req.body);
  res.status(201).json(result);
});

export const setManualGoal = asyncHandler(async (req, res) => {
  const goal = await service.setManualGoal(req.user!.id, req.body);
  res.status(201).json(goal);
});

export const listGoalHistory = asyncHandler(async (req, res) => {
  res.status(200).json(await service.listGoalHistory(req.user!.id));
});
