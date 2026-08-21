import { Router } from "express";
import { collections } from "../db.js";
import { serialize } from "../lib/serialize.js";

export const auditRouter = Router();

auditRouter.get("/", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.type === "string") filter.type = req.query.type;
  if (typeof req.query.actor === "string") filter.actor = req.query.actor;
  if (typeof req.query.documentId === "string") filter["refs.documentId"] = req.query.documentId;
  if (typeof req.query.citationId === "string") filter["refs.citationId"] = req.query.citationId;
  if (typeof req.query.codeId === "string") filter["refs.codeId"] = req.query.codeId;

  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  if (from || to) {
    filter.timestamp = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const sortOrder = req.query.sort === "asc" ? 1 : -1;
  const events = await collections.auditEvents
    .find(filter)
    .sort({ timestamp: sortOrder })
    .toArray();
  res.json(events.map(serialize));
});
