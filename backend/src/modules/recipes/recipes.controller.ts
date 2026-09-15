import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./recipes.service.js";

export const createRecipe = asyncHandler(async (req, res) => {
  const recipe = await service.createRecipe(req.user!.id, req.body);
  res.status(201).json(recipe);
});

export const getRecipe = asyncHandler(async (req, res) => {
  const result = await service.getRecipeWithNutrition(req.user!.id, req.params.id);
  res.status(200).json(result);
});

export const listRecipes = asyncHandler(async (req, res) => {
  const recipes = await service.listRecipes(req.user!.id);
  res.status(200).json(recipes);
});

export const deleteRecipe = asyncHandler(async (req, res) => {
  await service.deleteRecipe(req.user!.id, req.params.id);
  res.status(204).send();
});

export const logRecipe = asyncHandler(async (req, res) => {
  const log = await service.logRecipe(req.user!.id, req.params.id, req.body);
  res.status(201).json(log);
});
