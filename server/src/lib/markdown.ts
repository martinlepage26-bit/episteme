interface CodeView {
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
  history: { field: string; oldValue: string; newValue: string; changedAt: string; changedBy: string }[];
}

interface DocumentView {
  id: string;
  code: string;
  title: string;
}

interface CitationView {
  id: string;
  code: string;
  documentId: string;
  text: string;
  locationStart: number;
  locationEnd: number;
  createdBy: string;
  createdAt: string;
}

interface CodingEventView {
  id: string;
  citationId: string;
  codeId: string;
  coder: string;
  memo: string;
  createdAt: string;
  revoked: boolean;
}

export function buildCodebookMarkdown(codes: CodeView[]): string {
  const byId = new Map(codes.map((c) => [c.id, c]));
  const lines: string[] = [
    "# Codebook — Épistémè",
    "",
    `Généré le ${new Date().toISOString()} · ${codes.length} code(s)`,
    "",
  ];

  for (const code of codes) {
    const parent = code.parentId ? byId.get(code.parentId) : null;
    lines.push(`## ${code.code} — ${code.name}`, "");
    if (parent) lines.push(`**Code parent :** ${parent.code} — ${parent.name}`, "");
    lines.push(`**Définition :** ${code.definition || "—"}`, "");
    lines.push(`**Critères d'inclusion :** ${code.inclusionCriteria || "—"}`, "");
    lines.push(`**Critères d'exclusion :** ${code.exclusionCriteria || "—"}`, "");
    lines.push(`**Exemple d'énoncé :** ${code.example || "—"}`, "");
    lines.push(`**Créé par :** ${code.createdBy} le ${code.createdAt}`, "");
    lines.push(`**Dernière modification :** ${code.updatedAt}`, "");

    if (code.history.length > 0) {
      lines.push("**Historique :**", "");
      for (const entry of code.history) {
        lines.push(
          `- ${entry.changedAt} · ${entry.changedBy} · ${entry.field} : « ${entry.oldValue} » → « ${entry.newValue} »`,
        );
      }
      lines.push("");
    }

    lines.push("---", "");
  }

  return lines.join("\n");
}

export function buildQuotationBookMarkdown(
  citations: CitationView[],
  documents: DocumentView[],
  codingEvents: CodingEventView[],
  codes: CodeView[],
): string {
  const documentById = new Map(documents.map((d) => [d.id, d]));
  const codeById = new Map(codes.map((c) => [c.id, c]));
  const eventsByCitation = new Map<string, CodingEventView[]>();
  for (const event of codingEvents) {
    if (!eventsByCitation.has(event.citationId)) eventsByCitation.set(event.citationId, []);
    eventsByCitation.get(event.citationId)!.push(event);
  }

  const lines: string[] = [
    "# Recueil de citations — Épistémè",
    "",
    `Généré le ${new Date().toISOString()} · ${citations.length} citation(s)`,
    "",
  ];

  for (const citation of citations) {
    const document = documentById.get(citation.documentId);
    const events = (eventsByCitation.get(citation.id) ?? []).filter((e) => !e.revoked);

    lines.push(
      `## ${citation.code} — ${document ? `${document.code} « ${document.title} »` : "document inconnu"}`,
      "",
    );
    lines.push(`**Position :** caractères ${citation.locationStart}–${citation.locationEnd}`, "");
    lines.push(`**Texte :** « ${citation.text} »`, "");
    lines.push(`**Codeur (citation) :** ${citation.createdBy} · ${citation.createdAt}`, "");

    if (events.length === 0) {
      lines.push("**Codes appliqués :** aucun", "");
    } else {
      lines.push("**Codes appliqués :**", "");
      for (const event of events) {
        const code = codeById.get(event.codeId);
        lines.push(
          `- ${code ? `${code.code} « ${code.name} »` : event.codeId} · codeur ${event.coder} · ${event.createdAt}${
            event.memo ? ` · mémo : ${event.memo}` : ""
          }`,
        );
      }
      lines.push("");
    }

    lines.push("---", "");
  }

  return lines.join("\n");
}
