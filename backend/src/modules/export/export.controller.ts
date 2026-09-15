import { asyncHandler } from "../../utils/asyncHandler.js";
import * as service from "./export.service.js";

export const createExport = asyncHandler(async (req, res) => {
  const result = await service.createExport(req.user!.id, req.body.format);
  res.status(201).json(result);
});

export const downloadExport = asyncHandler(async (req, res) => {
  const { content, format } = await service.downloadExport(
    req.user!.id,
    req.params.id,
    req.query.token as string
  );
  res.setHeader(
    "Content-Type",
    format === "JSON" ? "application/json" : "text/csv"
  );
  res.setHeader("Content-Disposition", `attachment; filename="nutritrack-export.${format.toLowerCase()}"`);
  res.status(200).send(content);
});
