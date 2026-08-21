/** Posture analytique. A = interprétation, B = contraste (voir SPEC §2). */
export type Stance = "A" | "B";

export const STANCE_LABELS: Record<Stance, string> = {
  A: "interprétation",
  B: "contraste",
};

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

/** Session formelle : le triplet (codeur, posture, corpus) qui ancre un passage. */
export interface SessionRecord {
  code: string;
  project: string;
  coder: string;
  stance: Stance;
  corpusSize: number;
  startedAt: string;
  endedAt: string | null;
}

export interface CodingEventRecord {
  citationId: string;
  codeId: string;
  coder: string;
  stance: Stance;
  sessionId: string | null;
  memo: string;
  memoCode: string | null;
  createdAt: string;
  revoked: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
}

export type ReconciliationDecision = "keep_both" | "keep_a" | "keep_b" | "new_code";

export const DECISION_LABELS: Record<ReconciliationDecision, string> = {
  keep_both: "conserver les deux codes",
  keep_a: "conserver le codage de la passe A",
  keep_b: "conserver le codage de la passe B",
  new_code: "codage final distinct",
};

/**
 * Objet de réconciliation (SPEC §2). Il ne fusionne pas les deux lectures : il
 * enregistre la décision et son motif, en conservant l'état des deux passes au
 * moment où la décision a été prise.
 */
export interface ReconciliationRecord {
  code: string;
  citationId: string;
  decision: ReconciliationDecision;
  finalCodeIds: string[];
  passACodeIds: string[];
  passBCodeIds: string[];
  motif: string;
  reconciledBy: string;
  reconciledAt: string;
}

export type AuditEventType =
  | "DOCUMENT_CREATED"
  | "CITATION_CREATED"
  | "CODE_CREATED"
  | "CODE_UPDATED"
  | "CODE_APPLIED"
  | "CODE_REVOKED"
  | "MEMO_CREATED"
  | "SESSION_STARTED"
  | "SESSION_ENDED"
  | "CONFLICT_DETECTED"
  | "RECONCILIATION";

export interface AuditEventRefs {
  documentId?: string;
  citationId?: string;
  codeId?: string;
  codingEventId?: string;
  sessionId?: string;
  reconciliationId?: string;
}

export interface AuditEventRecord {
  /** Rang absolu dans la chaîne. Strictement croissant, sans trou. */
  seq: number;
  type: AuditEventType;
  timestamp: string;
  actor: string;
  stance: Stance | null;
  summary: string;
  refs: AuditEventRefs;
  /** Empreinte de l'événement précédent ; 64 zéros pour le premier. */
  prevHash: string;
  /** SHA-256 du contenu canonique de cet événement, prevHash inclus. */
  hash: string;
}
