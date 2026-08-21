import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections, nextId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { serialize } from "../lib/serialize.js";

export const codingEventsRouter = Router();

codingEventsRouter.get("/", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.citationId === "string") filter.citationId = req.query.citationId;
  if (typeof req.query.codeId === "string") filter.codeId = req.query.codeId;
  const events = await collections.codingEvents.find(filter).sort({ createdAt: 1 }).toArray();
  res.json(events.map(serialize));
});

codingEventsRouter.post("/", async (req, res) => {
  const { citationId, codeId, coder, memo } = req.body ?? {};
  if (!citationId || !codeId || !coder) {
    res.status(400).json({ error: "citationId, codeId et coder sont requis" });
    return;
  }

  const [citation, code] = await Promise.all([
    collections.citations.findOne({ _id: new ObjectId(citationId) }),
    collections.codes.findOne({ _id: new ObjectId(codeId) }),
  ]);
  if (!citation) {
    res.status(404).json({ error: "Citation introuvable" });
    return;
  }
  if (!code) {
    res.status(404).json({ error: "Code introuvable" });
    return;
  }

  const now = new Date().toISOString();
  const memoCode = memo ? await nextId("M", { dash: true, pad: 3 }) : null;
  const record = {
    citationId,
    codeId,
    coder,
    memo: memo ?? "",
    memoCode,
    createdAt: now,
    revoked: false,
    revokedAt: null,
    revokedBy: null,
  };
  const result = await collections.codingEvents.insertOne(record);
  const codingEventId = result.insertedId.toHexString();

  await recordAuditEvent(
    "CODE_APPLIED",
    coder,
    `Code appliqué – ${citation.code} → « ${code.name} »`,
    { citationId, codeId, codingEventId },
  );

  if (memoCode) {
    await recordAuditEvent(
      "MEMO_CREATED",
      coder,
      `Mémo créé – ${memoCode} (note sur ${citation.code})`,
      { citationId, codeId, codingEventId },
    );
  }

  res.status(201).json(serialize({ _id: result.insertedId, ...record }));
});

codingEventsRouter.post("/:id/revoke", async (req, res) => {
  const { revokedBy } = req.body ?? {};
  if (!revokedBy) {
    res.status(400).json({ error: "revokedBy est requis" });
    return;
  }

  const existing = await collections.codingEvents.findOne({ _id: new ObjectId(req.params.id) });
  if (!existing) {
    res.status(404).json({ error: "Événement de codage introuvable" });
    return;
  }
  if (existing.revoked) {
    res.json(serialize(existing));
    return;
  }

  const [citation, code] = await Promise.all([
    collections.citations.findOne({ _id: new ObjectId(existing.citationId) }),
    collections.codes.findOne({ _id: new ObjectId(existing.codeId) }),
  ]);

  const now = new Date().toISOString();
  await collections.codingEvents.updateOne(
    { _id: existing._id },
    { $set: { revoked: true, revokedAt: now, revokedBy } },
  );
  const updated = await collections.codingEvents.findOne({ _id: existing._id });

  await recordAuditEvent(
    "CODE_REVOKED",
    revokedBy,
    `Code révoqué – ${citation?.code ?? existing.citationId} ↛ « ${code?.name ?? existing.codeId} »`,
    {
      citationId: existing.citationId,
      codeId: existing.codeId,
      codingEventId: existing._id!.toHexString(),
    },
  );

  res.json(serialize(updated!));
});
