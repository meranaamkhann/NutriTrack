import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createRecipeSchema, recipeIdParamSchema, logRecipeSchema } from "./recipes.schemas.js";
import * as ctrl from "./recipes.controller.js";

export const recipesRouter = Router();
recipesRouter.use(requireAuth);

recipesRouter.get("/", ctrl.listRecipes);
recipesRouter.post("/", validate(createRecipeSchema), ctrl.createRecipe);
recipesRouter.get("/:id", validate(recipeIdParamSchema), ctrl.getRecipe);
recipesRouter.delete("/:id", validate(recipeIdParamSchema), ctrl.deleteRecipe);
recipesRouter.post("/:id/log", validate(logRecipeSchema), ctrl.logRecipe);
