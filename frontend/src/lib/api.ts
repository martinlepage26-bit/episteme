import type {
  AuditEventItem,
  AuthStatus,
  ChainVerification,
  CitationItem,
  CodeItem,
  CodingEventItem,
  ComparisonResult,
  DocumentItem,
  ReconciliationDecision,
  ReconciliationItem,
  SessionItem,
  Stance,
} from "./types";

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentification requise");
    this.name = "UnauthorizedError";
  }
}

/**
 * Notifié dès qu'une requête revient 401, pour que l'application repasse à
 * l'écran de connexion sans attendre une action de l'utilisateur.
 */
let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) {
    unauthorizedHandler?.();
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Erreur ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    status: () => request<AuthStatus>("/auth/status"),
    login: (passphrase: string) =>
      request<AuthStatus>("/auth/login", { method: "POST", body: JSON.stringify({ passphrase }) }),
    logout: () => request<AuthStatus>("/auth/logout", { method: "POST" }),
  },
  documents: {
    list: () => request<DocumentItem[]>("/documents"),
    get: (id: string) => request<DocumentItem>(`/documents/${id}`),
    create: (data: {
      title: string;
      sourceType: string;
      metadata: Record<string, string>;
      content: string;
      createdBy: string;
    }) => request<DocumentItem>("/documents", { method: "POST", body: JSON.stringify(data) }),
  },
  citations: {
    list: (documentId?: string) =>
      request<CitationItem[]>(`/citations${documentId ? `?documentId=${documentId}` : ""}`),
    create: (data: {
      documentId: string;
      text: string;
      locationStart: number;
      locationEnd: number;
      createdBy: string;
    }) => request<CitationItem>("/citations", { method: "POST", body: JSON.stringify(data) }),
  },
  codes: {
    list: () => request<CodeItem[]>("/codes"),
    create: (data: {
      name: string;
      definition: string;
      inclusionCriteria: string;
      exclusionCriteria: string;
      example: string;
      parentId: string | null;
      createdBy: string;
    }) => request<CodeItem>("/codes", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CodeItem> & { changedBy: string }) =>
      request<CodeItem>(`/codes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  sessions: {
    list: () => request<SessionItem[]>("/sessions"),
    create: (data: { project: string; coder: string; stance: Stance }) =>
      request<SessionItem>("/sessions", { method: "POST", body: JSON.stringify(data) }),
    end: (id: string) => request<SessionItem>(`/sessions/${id}/end`, { method: "POST" }),
  },
  codingEvents: {
    list: (filter?: { citationId?: string; codeId?: string; stance?: Stance }) => {
      const params = new URLSearchParams();
      if (filter?.citationId) params.set("citationId", filter.citationId);
      if (filter?.codeId) params.set("codeId", filter.codeId);
      if (filter?.stance) params.set("stance", filter.stance);
      const qs = params.toString();
      return request<CodingEventItem[]>(`/coding-events${qs ? `?${qs}` : ""}`);
    },
    create: (data: {
      citationId: string;
      codeId: string;
      coder: string;
      stance: Stance;
      sessionId?: string | null;
      memo?: string;
    }) => request<CodingEventItem>("/coding-events", { method: "POST", body: JSON.stringify(data) }),
    revoke: (id: string, revokedBy: string) =>
      request<CodingEventItem>(`/coding-events/${id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ revokedBy }),
      }),
  },
  reconciliations: {
    list: () => request<ReconciliationItem[]>("/reconciliations"),
    create: (data: {
      citationId: string;
      decision: ReconciliationDecision;
      finalCodeIds: string[];
      motif: string;
      reconciledBy: string;
    }) => request<ReconciliationItem>("/reconciliations", { method: "POST", body: JSON.stringify(data) }),
  },
  compare: {
    get: () => request<ComparisonResult>("/compare"),
  },
  audit: {
    list: (filter?: Record<string, string>) => {
      const params = new URLSearchParams(filter);
      const qs = params.toString();
      return request<AuditEventItem[]>(`/audit${qs ? `?${qs}` : ""}`);
    },
    verify: () => request<ChainVerification>("/audit/verify"),
  },
};

const CODER_KEY = "episteme.coder";
const STANCE_KEY = "episteme.stance";
const SESSION_KEY = "episteme.sessionId";

export function getCoder(): string {
  return localStorage.getItem(CODER_KEY) ?? "";
}

export function setCoder(name: string) {
  localStorage.setItem(CODER_KEY, name);
}

export function getStance(): Stance {
  return localStorage.getItem(STANCE_KEY) === "B" ? "B" : "A";
}

export function setStance(stance: Stance) {
  localStorage.setItem(STANCE_KEY, stance);
}

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionId(id: string | null) {
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}
