import { MongoClient, type Collection, type Document as MongoDocument } from "mongodb";
import type {
  AuditEventRecord,
  CitationRecord,
  CodeRecord,
  CodingEventRecord,
  DocumentRecord,
  ReconciliationRecord,
  SessionRecord,
} from "./types.js";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27018/episteme";
const client = new MongoClient(uri);

/**
 * Délai de la sonde `/api/status`. Court pour qu'un MongoDB arrêté (disque
 * plein, processus mort) fasse échouer la sonde au lieu de la laisser pendre
 * jusqu'au `serverSelectionTimeoutMS` du pilote (30 s par défaut).
 */
export const MONGO_PING_TIMEOUT_MS = 2_000;

export interface MongoAdminPing {
  ping(options?: { timeoutMS?: number; maxTimeMS?: number }): Promise<unknown>;
}

/** `admin.ping` avec un délai côté pilote et côté serveur. */
export function pingAdmin(admin: MongoAdminPing, timeoutMs: number): Promise<unknown> {
  return admin.ping({ timeoutMS: timeoutMs, maxTimeMS: timeoutMs });
}

export function pingMongo(timeoutMs = MONGO_PING_TIMEOUT_MS): Promise<unknown> {
  return pingAdmin(client.db().admin(), timeoutMs);
}

let connected = false;

const db = client.db();

interface CounterRecord extends MongoDocument {
  _id: string;
  seq: number;
}

export const collections = {
  counters: db.collection<CounterRecord>("counters"),
  documents: db.collection<DocumentRecord>("documents") as Collection<DocumentRecord>,
  citations: db.collection<CitationRecord>("citations") as Collection<CitationRecord>,
  codes: db.collection<CodeRecord>("codes") as Collection<CodeRecord>,
  codingEvents: db.collection<CodingEventRecord>("codingEvents") as Collection<CodingEventRecord>,
  sessions: db.collection<SessionRecord>("sessions") as Collection<SessionRecord>,
  reconciliations: db.collection<ReconciliationRecord>(
    "reconciliations",
  ) as Collection<ReconciliationRecord>,
  auditEvents: db.collection<AuditEventRecord>("auditEvents") as Collection<AuditEventRecord>,
};

export async function connectDb() {
  if (connected) return;
  await client.connect();
  connected = true;
}

/**
 * Crée les index. Séparé de la connexion parce que l'index unique sur `seq`
 * ne peut pas être construit tant que d'anciens événements n'ont pas de rang :
 * la migration doit tourner d'abord (`npm run migrate`).
 */
export async function ensureIndexes() {
  await Promise.all([
    // `seq` unique : deux événements ne peuvent pas occuper le même rang, ce
    // qui est la condition minimale pour qu'une chaîne soit vérifiable.
    collections.auditEvents.createIndex({ seq: 1 }, { unique: true }),
    collections.auditEvents.createIndex({ timestamp: 1 }),
    collections.auditEvents.createIndex({ type: 1 }),
    collections.citations.createIndex({ documentId: 1 }),
    collections.codingEvents.createIndex({ citationId: 1 }),
    collections.codingEvents.createIndex({ codeId: 1 }),
    collections.codingEvents.createIndex({ stance: 1 }),
    collections.reconciliations.createIndex({ citationId: 1 }, { unique: true }),
  ]);
}

export async function nextId(
  prefix: "D" | "Q" | "C" | "M" | "R" | "E",
  options: { dash: boolean; pad: number },
): Promise<string> {
  const result = await collections.counters.findOneAndUpdate(
    { _id: prefix },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  const seq = result?.seq ?? 1;
  const number = options.pad > 0 ? String(seq).padStart(options.pad, "0") : String(seq);
  return options.dash ? `${prefix}-${number}` : `${prefix}${number}`;
}

/** Identifiant de session daté : S-2026-08-21-004 (compteur par jour). */
export async function nextSessionId(date: Date): Promise<string> {
  const day = date.toISOString().slice(0, 10);
  const result = await collections.counters.findOneAndUpdate(
    { _id: `S:${day}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  const seq = result?.seq ?? 1;
  return `S-${day}-${String(seq).padStart(3, "0")}`;
}
