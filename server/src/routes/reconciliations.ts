import { Router } from "express";
import { collections } from "../db.js";
import { recordAuditEvent } from "../lib/audit.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseObjectId } from "../lib/objectId.js";
import { serialize } from "../lib/serialize.js";
import { activeCodeIdsByStance } from "../lib/compare.js";
import { DECISION_LABELS, type ReconciliationDecision } from "../types.js";

export const reconciliationsRouter = Router();

const DECISIONS: ReconciliationDecision[] = ["keep_both", "keep_a", "keep_b", "new_code"];

reconciliationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.citationId === "string") filter.citationId = req.query.citationId;
    const records = await collections.reconciliations.find(filter).sort({ reconciledAt: 1 }).toArray();
    res.json(records.map(serialize));
  }),
);

reconciliationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { citationId, decision, finalCodeIds, motif, reconciledBy } = req.body ?? {};
    if (!citationId || !reconciledBy) {
      res.status(400).json({ error: "citationId et reconciledBy sont requis" });
      return;
    }
    if (!DECISIONS.includes(decision)) {
      res.status(400).json({ error: `decision doit être l'une de : ${DECISIONS.join(", ")}` });
      return;
    }
    if (!motif) {
      res.status(400).json({ error: "motif est requis : une décision sans raison n'est pas traçable" });
      return;
    }

    const citationObjectId = parseObjectId(citationId);
    if (!citationObjectId) {
      res.status(400).json({ error: "Identifiant de citation invalide" });
      return;
    }
    const citation = await collections.citations.findOne({ _id: citationObjectId });
    if (!citation) {
      res.status(404).json({ error: "Citation introuvable" });
      return;
    }

    // L'état des deux passes est figé au moment de la décision : c'est ce que
    // le chercheur avait sous les yeux, et cela ne doit pas bouger ensuite.
    const { A: passACodeIds, B: passBCodeIds } = await activeCodeIdsByStance(citationId);

    const requestedFinal: string[] = Array.isArray(finalCodeIds) ? finalCodeIds : [];
    const resolvedFinal =
      decision === "keep_both"
        ? [...new Set([...passACodeIds, ...passBCodeIds])]
        : decision === "keep_a"
          ? passACodeIds
          : decision === "keep_b"
            ? passBCodeIds
            : requestedFinal;

    if (resolvedFinal.length === 0) {
      res.status(400).json({ error: "Le codage final est vide : précisez au moins un code" });
      return;
    }
    for (const id of resolvedFinal) {
      const objectId = parseObjectId(id);
      if (!objectId || !(await collections.codes.findOne({ _id: objectId }))) {
        res.status(400).json({ error: `Code final introuvable : ${id}` });
        return;
      }
    }

    const codes = await collections.codes.find().toArray();
    const nameByHex = new Map(codes.map((c) => [c._id!.toHexString(), c.name]));
    const render = (ids: string[]) =>
      ids.length === 0 ? "—" : ids.map((id) => `« ${nameByHex.get(id) ?? id} »`).join(", ");

    const reconciledAt = new Date().toISOString();
    const code = `R${citation.code.replace(/^Q/, "")}`;
    const record = {
      code,
      citationId,
      decision: decision as ReconciliationDecision,
      finalCodeIds: resolvedFinal,
      passACodeIds,
      passBCodeIds,
      motif,
      reconciledBy,
      reconciledAt,
    };

    const existing = await collections.reconciliations.findOne({ citationId });
    let id: string;
    if (existing) {
      await collections.reconciliations.updateOne({ _id: existing._id }, { $set: record });
      id = existing._id!.toHexString();
    } else {
      const result = await collections.reconciliations.insertOne(record);
      id = result.insertedId.toHexString();
    }

    await recordAuditEvent(
      "RECONCILIATION",
      reconciledBy,
      `Réconciliation ${code} – ${citation.code} : A→${render(passACodeIds)} / B→${render(passBCodeIds)} · décision : ${DECISION_LABELS[record.decision]} · final : ${render(resolvedFinal)} · motif : ${motif}`,
      { citationId, reconciliationId: id },
    );

    res.status(existing ? 200 : 201).json({ id, ...record });
  }),
);
