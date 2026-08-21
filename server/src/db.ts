import { MongoClient, type Collection, type Document as MongoDocument } from "mongodb";
import type {
  AuditEventRecord,
  CitationRecord,
  CodeRecord,
  CodingEventRecord,
  DocumentRecord,
} from "./types.js";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27018/episteme";
const client = new MongoClient(uri);

let connected = false;

export async function connectDb() {
  if (connected) return;
  await client.connect();
  connected = true;
}

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
  auditEvents: db.collection<AuditEventRecord>("auditEvents") as Collection<AuditEventRecord>,
};

export async function nextId(
  prefix: "D" | "Q" | "C" | "M",
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
