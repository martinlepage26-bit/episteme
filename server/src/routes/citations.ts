import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections, nextId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { serialize } from "../lib/serialize.js";

export const citationsRouter = Router();

citationsRouter.get("/", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.documentId === "string") {
    filter.documentId = req.query.documentId;
  }
  const citations = await collections.citations.find(filter).sort({ createdAt: 1 }).toArray();
  res.json(citations.map(serialize));
});

citationsRouter.post("/", async (req, res) => {
  const { documentId, text, locationStart, locationEnd, createdBy } = req.body ?? {};
  if (!documentId || !text || !createdBy) {
    res.status(400).json({ error: "documentId, text et createdBy sont requis" });
    return;
  }

  const document = await collections.documents.findOne({ _id: new ObjectId(documentId) });
  if (!document) {
    res.status(404).json({ error: "Document introuvable" });
    return;
  }

  const code = await nextId("Q", { dash: false, pad: 0 });
  const now = new Date().toISOString();
  const citation = {
    code,
    documentId,
    text,
    locationStart: typeof locationStart === "number" ? locationStart : 0,
    locationEnd: typeof locationEnd === "number" ? locationEnd : text.length,
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
});
