import { Router } from "express";
import { collections, nextSessionId } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseObjectId } from "../lib/objectId.js";
import { serialize } from "../lib/serialize.js";
import { STANCE_LABELS, type Stance } from "../types.js";

export const sessionsRouter = Router();

sessionsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const sessions = await collections.sessions.find().sort({ startedAt: -1 }).toArray();
    res.json(sessions.map(serialize));
  }),
);

sessionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { project, coder, stance } = req.body ?? {};
    if (!coder) {
      res.status(400).json({ error: "coder est requis" });
      return;
    }
    if (stance !== "A" && stance !== "B") {
      res.status(400).json({ error: "stance doit valoir « A » (interprétation) ou « B » (contraste)" });
      return;
    }

    const startedAt = new Date();
    const corpusSize = await collections.documents.countDocuments();
    const code = await nextSessionId(startedAt);
    const record = {
      code,
      project: project ?? "",
      coder,
      stance: stance as Stance,
      corpusSize,
      startedAt: startedAt.toISOString(),
      endedAt: null,
    };
    const result = await collections.sessions.insertOne(record);

    await recordAuditEvent(
      "SESSION_STARTED",
      coder,
      `Session ouverte – ${code} (projet : ${record.project || "—"}, corpus ${corpusSize} doc., codeur : ${coder}, posture : ${STANCE_LABELS[record.stance]})`,
      { sessionId: result.insertedId.toHexString() },
      record.stance,
    );

    res.status(201).json(serialize({ _id: result.insertedId, ...record }));
  }),
);

sessionsRouter.post(
  "/:id/end",
  asyncHandler(async (req, res) => {
    const id = parseObjectId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Identifiant de session invalide" });
      return;
    }

    const session = await collections.sessions.findOne({ _id: id });
    if (!session) {
      res.status(404).json({ error: "Session introuvable" });
      return;
    }
    if (session.endedAt) {
      res.json(serialize(session));
      return;
    }

    const endedAt = new Date().toISOString();
    await collections.sessions.updateOne({ _id: id }, { $set: { endedAt } });
    const updated = await collections.sessions.findOne({ _id: id });

    const codedCount = await collections.codingEvents.countDocuments({
      sessionId: req.params.id,
      revoked: false,
    });

    await recordAuditEvent(
      "SESSION_ENDED",
      session.coder,
      `Session close – ${session.code} (${codedCount} codage(s) actifs)`,
      { sessionId: req.params.id },
      session.stance,
    );

    res.json(serialize(updated!));
  }),
);
