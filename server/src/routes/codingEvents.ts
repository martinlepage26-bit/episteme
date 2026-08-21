import { Router } from "express";
import { collections, nextId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseObjectId } from "../lib/objectId.js";
import { serialize } from "../lib/serialize.js";
import { activeCodeIdsByStance } from "../lib/compare.js";
import { STANCE_LABELS, type Stance } from "../types.js";

export const codingEventsRouter = Router();

function parseStance(value: unknown): Stance | null {
  return value === "A" || value === "B" ? value : null;
}

/**
 * Signale une divergence entre les deux passes sur une même citation.
 *
 * La divergence est une donnée, pas une anomalie à corriger (SPEC §2) : elle
 * est inscrite au journal pour rester visible jusqu'à une réconciliation
 * explicite. On n'inscrit pas deux fois la même divergence.
 */
async function noteConflictIfAny(citationId: string, citationCode: string, actor: string) {
  const { A, B } = await activeCodeIdsByStance(citationId);
  if (A.length === 0 || B.length === 0) return;

  const sameSet = A.length === B.length && A.every((id) => B.includes(id));
  if (sameSet) return;

  const codes = await collections.codes
    .find({ _id: { $in: [...A, ...B].map((id) => parseObjectId(id)!).filter(Boolean) } })
    .toArray();
  const nameById = new Map(codes.map((c) => [c._id!.toHexString(), c.name]));
  const render = (ids: string[]) => ids.map((id) => `« ${nameById.get(id) ?? id} »`).join(", ");

  const summary = `Conflit 2ᵉ codeur – ${citationCode} : A→${render(A)} / B→${render(B)}`;

  const alreadyNoted = await collections.auditEvents.findOne({
    type: "CONFLICT_DETECTED",
    "refs.citationId": citationId,
    summary,
  });
  if (alreadyNoted) return;

  await recordAuditEvent("CONFLICT_DETECTED", actor, summary, { citationId });
}

codingEventsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.citationId === "string") filter.citationId = req.query.citationId;
    if (typeof req.query.codeId === "string") filter.codeId = req.query.codeId;
    const stance = parseStance(req.query.stance);
    if (stance) filter.stance = stance;
    const events = await collections.codingEvents.find(filter).sort({ createdAt: 1 }).toArray();
    res.json(events.map(serialize));
  }),
);

codingEventsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { citationId, codeId, coder, memo, sessionId } = req.body ?? {};
    if (!citationId || !codeId) {
      res.status(400).json({ error: "citationId et codeId sont requis" });
      return;
    }

    const citationObjectId = parseObjectId(citationId);
    const codeObjectId = parseObjectId(codeId);
    if (!citationObjectId || !codeObjectId) {
      res.status(400).json({ error: "Identifiant de citation ou de code invalide" });
      return;
    }

    // Quand une session est fournie, c'est elle qui fait foi : le codeur et la
    // posture ne peuvent pas contredire la session qui les déclare.
    let stance = parseStance(req.body?.stance);
    let effectiveCoder = coder;
    let effectiveSessionId: string | null = null;

    if (sessionId) {
      const sessionObjectId = parseObjectId(sessionId);
      if (!sessionObjectId) {
        res.status(400).json({ error: "Identifiant de session invalide" });
        return;
      }
      const session = await collections.sessions.findOne({ _id: sessionObjectId });
      if (!session) {
        res.status(404).json({ error: "Session introuvable" });
        return;
      }
      if (session.endedAt) {
        res.status(400).json({ error: "Cette session est close : aucun codage ne peut y être ajouté" });
        return;
      }
      stance = session.stance;
      effectiveCoder = session.coder;
      effectiveSessionId = sessionId;
    }

    if (!effectiveCoder) {
      res.status(400).json({ error: "coder est requis" });
      return;
    }
    if (!stance) {
      res.status(400).json({ error: "stance doit valoir « A » (interprétation) ou « B » (contraste)" });
      return;
    }

    const [citation, code] = await Promise.all([
      collections.citations.findOne({ _id: citationObjectId }),
      collections.codes.findOne({ _id: codeObjectId }),
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
      coder: effectiveCoder,
      stance,
      sessionId: effectiveSessionId,
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
      effectiveCoder,
      `Code appliqué – ${citation.code} → « ${code.name} » (passe ${stance}, ${STANCE_LABELS[stance]})`,
      { citationId, codeId, codingEventId, ...(effectiveSessionId ? { sessionId: effectiveSessionId } : {}) },
      stance,
    );

    if (memoCode) {
      await recordAuditEvent(
        "MEMO_CREATED",
        effectiveCoder,
        `Mémo créé – ${memoCode} (note sur ${citation.code})`,
        { citationId, codeId, codingEventId },
        stance,
      );
    }

    await noteConflictIfAny(citationId, citation.code, effectiveCoder);

    res.status(201).json(serialize({ _id: result.insertedId, ...record }));
  }),
);

codingEventsRouter.post(
  "/:id/revoke",
  asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Identifiant d'événement invalide" });
      return;
    }

    const { revokedBy } = req.body ?? {};
    if (!revokedBy) {
      res.status(400).json({ error: "revokedBy est requis" });
      return;
    }

    const existing = await collections.codingEvents.findOne({ _id: id });
    if (!existing) {
      res.status(404).json({ error: "Événement de codage introuvable" });
      return;
    }
    if (existing.revoked) {
      res.json(serialize(existing));
      return;
    }

    const citationObjectId = parseObjectId(existing.citationId);
    const codeObjectId = parseObjectId(existing.codeId);
    const [citation, code] = await Promise.all([
      citationObjectId ? collections.citations.findOne({ _id: citationObjectId }) : null,
      codeObjectId ? collections.codes.findOne({ _id: codeObjectId }) : null,
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
      `Code révoqué – ${citation?.code ?? existing.citationId} ↛ « ${code?.name ?? existing.codeId} » (passe ${existing.stance})`,
      {
        citationId: existing.citationId,
        codeId: existing.codeId,
        codingEventId: existing._id!.toHexString(),
      },
      existing.stance ?? null,
    );

    res.json(serialize(updated!));
  }),
);
