import { Router } from "express";
import { collections, nextId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseObjectId } from "../lib/objectId.js";
import { serialize } from "../lib/serialize.js";

export const citationsRouter = Router();

citationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.documentId === "string") {
      filter.documentId = req.query.documentId;
    }
    const citations = await collections.citations.find(filter).sort({ createdAt: 1 }).toArray();
    res.json(citations.map(serialize));
  }),
);

citationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { documentId, text, locationStart, locationEnd, createdBy } = req.body ?? {};
    if (!documentId || !text || !createdBy) {
      res.status(400).json({ error: "documentId, text et createdBy sont requis" });
      return;
    }

    const documentObjectId = parseObjectId(documentId);
    if (!documentObjectId) {
      res.status(400).json({ error: "Identifiant de document invalide" });
      return;
    }

    const document = await collections.documents.findOne({ _id: documentObjectId });
    if (!document) {
      res.status(404).json({ error: "Document introuvable" });
      return;
    }

    // Les offsets ancrent la citation dans le texte du document : hors bornes,
    // le surlignage et le recoupement Pass A / Pass B deviennent faux.
    const start = typeof locationStart === "number" ? locationStart : 0;
    const end = typeof locationEnd === "number" ? locationEnd : text.length;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end > document.content.length ||
      start >= end
    ) {
      res.status(400).json({
        error: `Position invalide : ${start}–${end} hors du document (0–${document.content.length})`,
      });
      return;
    }

    const code = await nextId("Q", { dash: false, pad: 0 });
    const now = new Date().toISOString();
    const citation = {
      code,
      documentId,
      text,
      locationStart: start,
      locationEnd: end,
      createdBy,
      createdAt: now,
    };
    const result = await collections.citations.insertOne(citation);

    await recordAuditEvent(
      "CITATION_CREATED",
      createdBy,
      `Citation créée – Document ${document.code}, ID ${code}`,
      { documentId, citationId: result.insertedId.toHexString() },
    );

    res.status(201).json(serialize({ _id: result.insertedId, ...citation }));
  }),
);
