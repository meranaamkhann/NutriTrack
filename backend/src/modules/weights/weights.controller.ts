import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./weights.service.js";

export const upsertWeight = asyncHandler(async (req, res) => {
  const weight = await service.upsertWeight(req.user!.id, req.body);
  res.status(200).json(weight);
});

export const listWeights = asyncHandler(async (req, res) => {
  const weights = await service.listWeights(req.user!.id, req.query as never);
  res.status(200).json(weights);
});

export const deleteWeight = asyncHandler(async (req, res) => {
  await service.deleteWeight(req.user!.id, req.params.id);
  res.status(204).send();
});
