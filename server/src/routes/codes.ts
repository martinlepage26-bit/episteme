import { Router } from "express";
import { collections, nextId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseObjectId } from "../lib/objectId.js";
import { serialize } from "../lib/serialize.js";
import type { CodeHistoryEntry } from "../types.js";

export const codesRouter = Router();

const EDITABLE_FIELDS = [
  "name",
  "definition",
  "inclusionCriteria",
  "exclusionCriteria",
  "example",
  "parentId",
] as const;

/**
 * Remonte la hiérarchie depuis `parentId`. Renvoie `true` si `selfId` y figure,
 * c'est-à-dire si rattacher `selfId` à ce parent fermerait un cycle. Un cycle
 * rendrait le rendu hiérarchique du codebook infini.
 */
async function wouldCreateCycle(selfId: string, parentId: string): Promise<boolean> {
  let cursor: string | null = parentId;
  const seen = new Set<string>();

  while (cursor) {
    if (cursor === selfId) return true;
    if (seen.has(cursor)) return true; // cycle préexistant : on s'arrête
    seen.add(cursor);

    const objectId = parseObjectId(cursor);
    if (!objectId) return false;
    const parent = await collections.codes.findOne({ _id: objectId });
    cursor = parent?.parentId ?? null;
  }
  return false;
}

codesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const codes = await collections.codes.find().sort({ createdAt: 1 }).toArray();
    res.json(codes.map(serialize));
  }),
);

codesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Identifiant de code invalide" });
      return;
    }
    const code = await collections.codes.findOne({ _id: id });
    if (!code) {
      res.status(404).json({ error: "Code introuvable" });
      return;
    }
    res.json(serialize(code));
  }),
);

codesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, definition, inclusionCriteria, exclusionCriteria, example, parentId, createdBy } =
      req.body ?? {};
    if (!name || !definition || !createdBy) {
      res.status(400).json({ error: "name, definition et createdBy sont requis" });
      return;
    }

    if (parentId) {
      const parentObjectId = parseObjectId(parentId);
      if (!parentObjectId) {
        res.status(400).json({ error: "Identifiant de code parent invalide" });
        return;
      }
      const parent = await collections.codes.findOne({ _id: parentObjectId });
      if (!parent) {
        res.status(404).json({ error: "Code parent introuvable" });
        return;
      }
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

    await recordAuditEvent("CODE_CREATED", createdBy, `Code créé – ${displayCode} « ${name} »`, {
      codeId: result.insertedId.toHexString(),
    });

    res.status(201).json(serialize({ _id: result.insertedId, ...record }));
  }),
);

codesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Identifiant de code invalide" });
      return;
    }

    const { changedBy, ...updates } = req.body ?? {};
    if (!changedBy) {
      res.status(400).json({ error: "changedBy est requis" });
      return;
    }

    const existing = await collections.codes.findOne({ _id: id });
    if (!existing) {
      res.status(404).json({ error: "Code introuvable" });
      return;
    }

    if ("parentId" in updates && updates.parentId) {
      const parentObjectId = parseObjectId(updates.parentId);
      if (!parentObjectId) {
        res.status(400).json({ error: "Identifiant de code parent invalide" });
        return;
      }
      const parent = await collections.codes.findOne({ _id: parentObjectId });
      if (!parent) {
        res.status(404).json({ error: "Code parent introuvable" });
        return;
      }
      if (await wouldCreateCycle(req.params.id, updates.parentId)) {
        res.status(400).json({ error: "Ce rattachement créerait un cycle dans la hiérarchie" });
        return;
      }
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
  }),
);
