import type {
  AuditEventItem,
  CitationItem,
  CodeItem,
  CodingEventItem,
  DocumentItem,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Erreur ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  documents: {
    list: () => request<DocumentItem[]>("/documents"),
    get: (id: string) => request<DocumentItem>(`/documents/${id}`),
    create: (data: { title: string; sourceType: string; metadata: Record<string, string>; content: string; createdBy: string }) =>
      request<DocumentItem>("/documents", { method: "POST", body: JSON.stringify(data) }),
  },
  citations: {
    list: (documentId?: string) =>
      request<CitationItem[]>(`/citations${documentId ? `?documentId=${documentId}` : ""}`),
    create: (data: { documentId: string; text: string; locationStart: number; locationEnd: number; createdBy: string }) =>
      request<CitationItem>("/citations", { method: "POST", body: JSON.stringify(data) }),
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
  codingEvents: {
    list: (filter?: { citationId?: string; codeId?: string }) => {
      const params = new URLSearchParams();
      if (filter?.citationId) params.set("citationId", filter.citationId);
      if (filter?.codeId) params.set("codeId", filter.codeId);
      const qs = params.toString();
      return request<CodingEventItem[]>(`/coding-events${qs ? `?${qs}` : ""}`);
    },
    create: (data: { citationId: string; codeId: string; coder: string; memo?: string }) =>
      request<CodingEventItem>("/coding-events", { method: "POST", body: JSON.stringify(data) }),
    revoke: (id: string, revokedBy: string) =>
      request<CodingEventItem>(`/coding-events/${id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ revokedBy }),
      }),
  },
  audit: {
    list: (filter?: Record<string, string>) => {
      const params = new URLSearchParams(filter);
      const qs = params.toString();
      return request<AuditEventItem[]>(`/audit${qs ? `?${qs}` : ""}`);
    },
  },
};

const CODER_KEY = "episteme.coder";

export function getCoder(): string {
  return localStorage.getItem(CODER_KEY) ?? "";
}

export function setCoder(name: string) {
  localStorage.setItem(CODER_KEY, name);
}
