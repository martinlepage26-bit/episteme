export interface DocumentRecord {
  code: string;
  title: string;
  sourceType: string;
  metadata: Record<string, string>;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface CitationRecord {
  code: string;
  documentId: string;
  text: string;
  locationStart: number;
  locationEnd: number;
  createdBy: string;
  createdAt: string;
}

export interface CodeHistoryEntry {
  field: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
  changedBy: string;
}

export interface CodeRecord {
  code: string;
  name: string;
  definition: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  example: string;
  parentId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history: CodeHistoryEntry[];
}

export interface CodingEventRecord {
  citationId: string;
  codeId: string;
  coder: string;
  memo: string;
  memoCode: string | null;
  createdAt: string;
  revoked: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
}

export type AuditEventType =
  | "DOCUMENT_CREATED"
  | "CITATION_CREATED"
  | "CODE_CREATED"
  | "CODE_UPDATED"
  | "CODE_APPLIED"
  | "CODE_REVOKED"
  | "MEMO_CREATED";

export interface AuditEventRefs {
  documentId?: string;
  citationId?: string;
  codeId?: string;
  codingEventId?: string;
}

export interface AuditEventRecord {
  type: AuditEventType;
  timestamp: string;
  actor: string;
  summary: string;
  refs: AuditEventRefs;
}
