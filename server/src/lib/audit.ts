import crypto from "node:crypto";
import { collections } from "../db.js";
import type { AuditEventRecord, AuditEventRefs, AuditEventType, Stance } from "../types.js";

/** Empreinte conventionnelle précédant le premier événement. */
export const GENESIS_HASH = "0".repeat(64);

type ChainInput = Pick<
  AuditEventRecord,
  "seq" | "type" | "timestamp" | "actor" | "stance" | "summary" | "refs" | "prevHash"
>;

/**
 * Représentation canonique d'un événement.
 *
 * Un tableau JSON, et non un objet : l'ordre des éléments est garanti par la
 * structure, alors que l'ordre des clés d'un objet ne l'est pas. Les `refs`
 * sont réduites à des paires triées pour la même raison. Deux exécutions sur
 * le même événement produisent donc toujours la même chaîne — condition
 * nécessaire pour qu'une vérification ultérieure soit concluante.
 */
export function canonicalize(event: ChainInput): string {
  const refPairs = Object.entries(event.refs ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return JSON.stringify([
    event.seq,
    event.type,
    event.timestamp,
    event.actor,
    event.stance,
    event.summary,
    refPairs,
    event.prevHash,
  ]);
}

export function hashEvent(event: ChainInput): string {
  return crypto.createHash("sha256").update(canonicalize(event), "utf8").digest("hex");
}

/**
 * Verrou d'ajout.
 *
 * Le rang et l'empreinte précédente se déduisent du dernier événement présent.
 * Deux ajouts concurrents liraient le même « dernier événement » et
 * bifurqueraient la chaîne. Les ajouts sont donc sérialisés dans le processus.
 *
 * Contrainte connue : cette garantie vaut pour un processus unique. L'index
 * unique sur `seq` empêche une seconde instance d'écrire un rang déjà pris,
 * mais répliquer l'API demanderait un verrou partagé.
 */
let tail: Promise<unknown> = Promise.resolve();

function withAppendLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}

export async function recordAuditEvent(
  type: AuditEventType,
  actor: string,
  summary: string,
  refs: AuditEventRefs,
  stance: Stance | null = null,
): Promise<AuditEventRecord> {
  return withAppendLock(async () => {
    const last = await collections.auditEvents.find().sort({ seq: -1 }).limit(1).next();

    const event: AuditEventRecord = {
      seq: (last?.seq ?? 0) + 1,
      type,
      timestamp: new Date().toISOString(),
      actor,
      stance,
      summary,
      refs,
      prevHash: last?.hash ?? GENESIS_HASH,
      hash: "",
    };
    event.hash = hashEvent(event);

    await collections.auditEvents.insertOne(event);
    return event;
  });
}

export type ChainStatus = "verified" | "broken" | "empty";

export interface ChainVerification {
  status: ChainStatus;
  eventCount: number;
  /** Empreinte du dernier événement : l'ancre à citer dans un export. */
  headHash: string | null;
  firstBrokenSeq: number | null;
  reason: string | null;
}

/**
 * Recalcule la chaîne entière et signale la première rupture.
 *
 * Trois ruptures possibles, distinguées parce qu'elles ne disent pas la même
 * chose : un rang manquant (suppression), une empreinte précédente qui ne
 * correspond pas (réordonnancement ou insertion), une empreinte propre qui ne
 * correspond pas (modification du contenu de l'événement).
 */
export async function verifyChain(): Promise<ChainVerification> {
  const events = await collections.auditEvents.find().sort({ seq: 1 }).toArray();

  if (events.length === 0) {
    return { status: "empty", eventCount: 0, headHash: null, firstBrokenSeq: null, reason: null };
  }

  let previousHash = GENESIS_HASH;
  let expectedSeq = 1;

  for (const event of events) {
    if (event.seq !== expectedSeq) {
      return {
        status: "broken",
        eventCount: events.length,
        headHash: null,
        firstBrokenSeq: expectedSeq,
        reason: `Rang ${expectedSeq} absent de la séquence (trouvé ${event.seq}) — un événement a été retiré.`,
      };
    }

    if (event.prevHash !== previousHash) {
      return {
        status: "broken",
        eventCount: events.length,
        headHash: null,
        firstBrokenSeq: event.seq,
        reason: `L'événement ${event.seq} ne pointe pas vers l'empreinte du précédent — insertion ou réordonnancement.`,
      };
    }

    const recomputed = hashEvent(event);
    if (recomputed !== event.hash) {
      return {
        status: "broken",
        eventCount: events.length,
        headHash: null,
        firstBrokenSeq: event.seq,
        reason: `Le contenu de l'événement ${event.seq} ne correspond plus à son empreinte — modification après coup.`,
      };
    }

    previousHash = event.hash;
    expectedSeq += 1;
  }

  return {
    status: "verified",
    eventCount: events.length,
    headHash: previousHash,
    firstBrokenSeq: null,
    reason: null,
  };
}
