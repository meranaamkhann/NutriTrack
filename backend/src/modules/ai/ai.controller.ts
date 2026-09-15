import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./ai.service.js";

export const requestParse = asyncHandler(async (req, res) => {
  const result = await service.requestParse(req.user!.id, req.body.rawText);
  res.status(201).json(result);
});

export const acceptParse = asyncHandler(async (req, res) => {
  const logs = await service.acceptParse(req.user!.id, req.params.id, req.body.items);
  res.status(201).json(logs);
});
