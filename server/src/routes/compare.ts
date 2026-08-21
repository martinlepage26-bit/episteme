import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { buildComparison } from "../lib/compare.js";

export const compareRouter = Router();

compareRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await buildComparison());
  }),
);
