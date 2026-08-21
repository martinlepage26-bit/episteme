import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections, nextId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { serialize } from "../lib/serialize.js";

export const documentsRouter = Router();

documentsRouter.get("/", async (_req, res) => {
  const documents = await collections.documents.find().sort({ createdAt: -1 }).toArray();
  res.json(documents.map(serialize));
});

documentsRouter.get("/:id", async (req, res) => {
  const document = await collections.documents.findOne({ _id: new ObjectId(req.params.id) });
  if (!document) {
    res.status(404).json({ error: "Document introuvable" });
    return;
  }
  res.json(serialize(document));
});

documentsRouter.post("/", async (req, res) => {
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

  await recordAuditEvent(
    "DOCUMENT_CREATED",
    createdBy,
    `Document créé – ${code} « ${title} »`,
    { documentId: result.insertedId.toHexString() },
  );

  res.status(201).json(serialize({ _id: result.insertedId, ...document }));
});
