import { collections } from "../db.js";
import type { AuditEventRefs, AuditEventType } from "../types.js";

export async function recordAuditEvent(
  type: AuditEventType,
  actor: string,
  summary: string,
  refs: AuditEventRefs,
) {
  await collections.auditEvents.insertOne({
    type,
    timestamp: new Date().toISOString(),
    actor,
    summary,
    refs,
  });
}
