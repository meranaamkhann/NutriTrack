import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./foods.service.js";

export const createFood = asyncHandler(async (req, res) => {
  const food = await service.createFood(req.user!.id, req.body);
  res.status(201).json(food);
});

export const updateFood = asyncHandler(async (req, res) => {
  const food = await service.updateFood(req.user!.id, req.params.id, req.body);
  res.status(200).json(food);
});

export const deleteFood = asyncHandler(async (req, res) => {
  await service.deleteFood(req.user!.id, req.params.id);
  res.status(204).send();
});

export const searchFoods = asyncHandler(async (req, res) => {
  const foods = await service.searchFoods(req.user!.id, req.query as never);
  res.status(200).json(foods);
});

export const getFood = asyncHandler(async (req, res) => {
  const food = await service.getFoodById(req.user!.id, req.params.id);
  res.status(200).json(food);
});
