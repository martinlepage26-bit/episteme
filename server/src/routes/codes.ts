import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections, nextId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { serialize } from "../lib/serialize.js";
import type { CodeHistoryEntry } from "../types.js";

export const codesRouter = Router();

const EDITABLE_FIELDS = ["name", "definition", "inclusionCriteria", "exclusionCriteria", "example", "parentId"] as const;

codesRouter.get("/", async (_req, res) => {
  const codes = await collections.codes.find().sort({ createdAt: 1 }).toArray();
  res.json(codes.map(serialize));
});

codesRouter.get("/:id", async (req, res) => {
  const code = await collections.codes.findOne({ _id: new ObjectId(req.params.id) });
  if (!code) {
    res.status(404).json({ error: "Code introuvable" });
    return;
  }
  res.json(serialize(code));
});

codesRouter.post("/", async (req, res) => {
  const { name, definition, inclusionCriteria, exclusionCriteria, example, parentId, createdBy } =
    req.body ?? {};
  if (!name || !definition || !createdBy) {
    res.status(400).json({ error: "name, definition et createdBy sont requis" });
    return;
  }

  const displayCode = await nextId("C", { dash: true, pad: 3 });
  const now = new Date().toISOString();
  const record = {
    code: displayCode,
    name,
    definition,
    inclusionCriteria: inclusionCriteria ?? "",
    exclusionCriteria: exclusionCriteria ?? "",
    example: example ?? "",
    parentId: parentId ?? null,
    createdBy,
    createdAt: now,
    updatedAt: now,
    history: [] as CodeHistoryEntry[],
  };
  const result = await collections.codes.insertOne(record);

  await recordAuditEvent(
    "CODE_CREATED",
    createdBy,
    `Code créé – ${displayCode} « ${name} »`,
    { codeId: result.insertedId.toHexString() },
  );

  res.status(201).json(serialize({ _id: result.insertedId, ...record }));
});

codesRouter.patch("/:id", async (req, res) => {
  const { changedBy, ...updates } = req.body ?? {};
  if (!changedBy) {
    res.status(400).json({ error: "changedBy est requis" });
    return;
  }

  const existing = await collections.codes.findOne({ _id: new ObjectId(req.params.id) });
  if (!existing) {
    res.status(404).json({ error: "Code introuvable" });
    return;
  }

  const now = new Date().toISOString();
  const history: CodeHistoryEntry[] = [...existing.history];
  const changedFields: string[] = [];

  for (const field of EDITABLE_FIELDS) {
    if (field in updates && updates[field] !== existing[field]) {
      history.push({
        field,
        oldValue: String(existing[field] ?? ""),
        newValue: String(updates[field] ?? ""),
        changedAt: now,
        changedBy,
      });
      changedFields.push(field);
    }
  }

  if (changedFields.length === 0) {
    res.json(serialize(existing));
    return;
  }

  const setFields: Record<string, unknown> = { updatedAt: now, history };
  for (const field of changedFields) {
    setFields[field] = updates[field];
  }

  await collections.codes.updateOne({ _id: existing._id }, { $set: setFields });
  const updated = await collections.codes.findOne({ _id: existing._id });

  await recordAuditEvent(
    "CODE_UPDATED",
    changedBy,
    `Code modifié – ${existing.code} (${changedFields.join(", ")})`,
    { codeId: existing._id!.toHexString() },
  );

  res.json(serialize(updated!));
});
