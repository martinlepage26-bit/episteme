import crypto from "node:crypto";
import { collections, nextId } from "../db.js";
import { serialize } from "./serialize.js";
import { verifyChain } from "./audit.js";
import { STANCE_LABELS } from "../types.js";

/**
 * Export d'audit immuable (SPEC §1).
 *
 * Ce n'est pas une copie de la base : c'est la séquence d'événements telle que
 * la chaîne l'atteste, accompagnée des artefacts qu'elle référence pour que
 * chaque renvoi soit résolvable hors ligne. L'en-tête porte l'identifiant
 * d'export et le triplet de session, et le corps est scellé par sa propre
 * empreinte — un export modifié ne correspond plus à son `bodyHash`.
 */
export async function buildAuditExport(exportedBy: string) {
  const [chain, events, sessions, reconciliations, codes, citations, documents] = await Promise.all([
    verifyChain(),
    collections.auditEvents.find().sort({ seq: 1 }).toArray(),
    collections.sessions.find().sort({ startedAt: 1 }).toArray(),
    collections.reconciliations.find().sort({ reconciledAt: 1 }).toArray(),
    collections.codes.find().sort({ createdAt: 1 }).toArray(),
    collections.citations.find().sort({ createdAt: 1 }).toArray(),
    collections.documents.find().sort({ createdAt: 1 }).toArray(),
  ]);

  const exportId = await nextId("E", { dash: true, pad: 4 });
  const generatedAt = new Date().toISOString();

  const body = {
    sessionTriplet: sessions.map((session) => ({
      id: session._id!.toHexString(),
      code: session.code,
      project: session.project,
      coder: session.coder,
      stance: session.stance,
      stanceLabel: STANCE_LABELS[session.stance],
      corpusSize: session.corpusSize,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    })),
    chain: {
      status: chain.status,
      eventCount: chain.eventCount,
      headHash: chain.headHash,
      firstBrokenSeq: chain.firstBrokenSeq,
      reason: chain.reason,
      algorithm: "SHA-256",
      canonicalForm: "JSON array [seq, type, timestamp, actor, stance, summary, sortedRefPairs, prevHash]",
    },
    events: events.map((event) => ({
      seq: event.seq,
      type: event.type,
      timestamp: event.timestamp,
      actor: event.actor,
      stance: event.stance,
      summary: event.summary,
      refs: event.refs,
      prevHash: event.prevHash,
      hash: event.hash,
    })),
    reconciliations: reconciliations.map(serialize),
    artifacts: {
      codes: codes.map(serialize),
      citations: citations.map(serialize),
      // Métadonnées seulement : le corpus intégral n'est pas une preuve du
      // cheminement, et un export d'audit ne devrait pas redistribuer les
      // transcriptions.
      documents: documents.map((document) => ({
        id: document._id!.toHexString(),
        code: document.code,
        title: document.title,
        sourceType: document.sourceType,
        metadata: document.metadata,
        contentLength: document.content.length,
        contentHash: crypto.createHash("sha256").update(document.content, "utf8").digest("hex"),
        createdBy: document.createdBy,
        createdAt: document.createdAt,
      })),
    },
  };

  const bodyHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(body), "utf8")
    .digest("hex");

  return {
    export_id: exportId,
    generatedAt,
    exportedBy,
    product: "Épistémè",
    formatVersion: 1,
    bodyHash,
    ...body,
  };
}
