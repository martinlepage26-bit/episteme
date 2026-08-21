export type Stance = "A" | "B";

export const STANCE_LABELS: Record<Stance, string> = {
  A: "interprétation",
  B: "contraste",
};

export interface DocumentItem {
  id: string;
  code: string;
  title: string;
  sourceType: string;
  metadata: Record<string, string>;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface CitationItem {
  id: string;
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

export interface CodeItem {
  id: string;
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

export interface SessionItem {
  id: string;
  code: string;
  project: string;
  coder: string;
  stance: Stance;
  corpusSize: number;
  startedAt: string;
  endedAt: string | null;
}

export interface CodingEventItem {
  id: string;
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
  keep_both: "Conserver les deux codes",
  keep_a: "Conserver le codage de la passe A",
  keep_b: "Conserver le codage de la passe B",
  new_code: "Codage final distinct",
};

export interface ReconciliationItem {
  id: string;
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

export interface AuditEventItem {
  id: string;
  seq: number;
  type: AuditEventType;
  timestamp: string;
  actor: string;
  stance: Stance | null;
  summary: string;
  refs: {
    documentId?: string;
    citationId?: string;
    codeId?: string;
    codingEventId?: string;
    sessionId?: string;
    reconciliationId?: string;
  };
  prevHash: string;
  hash: string;
}

export interface ChainVerification {
  status: "verified" | "broken" | "empty";
  eventCount: number;
  headHash: string | null;
  firstBrokenSeq: number | null;
  reason: string | null;
}

export interface CitationComparison {
  citationId: string;
  citationCode: string;
  documentCode: string;
  text: string;
  passA: { codeId: string; codeCode: string; codeName: string; memo: string }[];
  passB: { codeId: string; codeCode: string; codeName: string; memo: string }[];
  contradiction: boolean;
  divergent: boolean;
  reconciliationCode: string | null;
}

export interface ComparisonResult {
  table: {
    citations: Record<Stance, number>;
    codesUsed: Record<Stance, number>;
    emergentThemes: Record<Stance, { code: string; name: string }[]>;
    contradictions: Record<Stance, number>;
  };
  delta: {
    interpretationChanged: number;
    secondCodeAdded: number;
    originalCodeLost: number;
    newThemes: number;
    contradictionsRevealed: number;
    reconciled: number;
    unreconciled: number;
  };
  citations: CitationComparison[];
}

export interface AuthStatus {
  authEnabled: boolean;
  authenticated: boolean;
}
