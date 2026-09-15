import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createFoodSchema, updateFoodSchema, foodIdParamSchema, searchFoodsSchema } from "./foods.schemas.js";
import * as ctrl from "./foods.controller.js";

export const foodsRouter = Router();
foodsRouter.use(requireAuth);

foodsRouter.get("/", validate(searchFoodsSchema), ctrl.searchFoods);
foodsRouter.post("/", validate(createFoodSchema), ctrl.createFood);
foodsRouter.get("/:id", validate(foodIdParamSchema), ctrl.getFood);
foodsRouter.put("/:id", validate(updateFoodSchema), ctrl.updateFood);
foodsRouter.delete("/:id", validate(foodIdParamSchema), ctrl.deleteFood);
