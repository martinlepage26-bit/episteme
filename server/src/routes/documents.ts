import { Router } from "express";
import { collections, nextId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseObjectId } from "../lib/objectId.js";
import { serialize } from "../lib/serialize.js";

export const documentsRouter = Router();

documentsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const documents = await collections.documents.find().sort({ createdAt: -1 }).toArray();
    res.json(documents.map(serialize));
  }),
);

documentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Identifiant de document invalide" });
      return;
    }
    const document = await collections.documents.findOne({ _id: id });
    if (!document) {
      res.status(404).json({ error: "Document introuvable" });
      return;
    }
    res.json(serialize(document));
  }),
);

documentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, sourceType, metadata, content, createdBy } = req.body ?? {};
    if (!title || !content || !createdBy) {
      res.status(400).json({ error: "title, content et createdBy sont requis" });
      return;
    }

    const code = await nextId("D", { dash: true, pad: 3 });
    const now = new Date().toISOString();
    const document = {
      code,
      title,
      sourceType: sourceType ?? "",
      metadata: metadata ?? {},
      content,
      createdBy,
      createdAt: now,
    };
    const result = await collections.documents.insertOne(document);

    await recordAuditEvent("DOCUMENT_CREATED", createdBy, `Document créé – ${code} « ${title} »`, {
      documentId: result.insertedId.toHexString(),
    });

    res.status(201).json(serialize({ _id: result.insertedId, ...document }));
  }),
);
