import { Router } from "express";
import { collections } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { serialize } from "../lib/serialize.js";
import { verifyChain } from "../lib/audit.js";

export const auditRouter = Router();

/**
 * Vérification de la chaîne. Déclarée avant « / » pour ne pas être capturée
 * par une route paramétrée, et volontairement sans filtre : on vérifie la
 * chaîne entière ou rien — une chaîne partielle ne prouve rien.
 */
auditRouter.get(
  "/verify",
  asyncHandler(async (_req, res) => {
    res.json(await verifyChain());
  }),
);

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.type === "string") filter.type = req.query.type;
    if (typeof req.query.actor === "string") filter.actor = req.query.actor;
    if (req.query.stance === "A" || req.query.stance === "B") filter.stance = req.query.stance;
    if (typeof req.query.documentId === "string") filter["refs.documentId"] = req.query.documentId;
    if (typeof req.query.citationId === "string") filter["refs.citationId"] = req.query.citationId;
    if (typeof req.query.codeId === "string") filter["refs.codeId"] = req.query.codeId;
    if (typeof req.query.sessionId === "string") filter["refs.sessionId"] = req.query.sessionId;

    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    if (from || to) {
      filter.timestamp = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }

    // Le rang, pas l'horodatage : deux événements de la même milliseconde
    // doivent rester dans l'ordre où la chaîne les a inscrits.
    const sortOrder = req.query.sort === "asc" ? 1 : -1;
    const events = await collections.auditEvents.find(filter).sort({ seq: sortOrder }).toArray();
    res.json(events.map(serialize));
  }),
);
