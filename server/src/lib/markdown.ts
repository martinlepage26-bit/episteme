import { DECISION_LABELS, STANCE_LABELS, type ReconciliationDecision, type Stance } from "../types.js";

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
  stance: Stance;
  memo: string;
  memoCode: string | null;
  createdAt: string;
  revoked: boolean;
}

interface ReconciliationView {
  id: string;
  code: string;
  citationId: string;
  decision: ReconciliationDecision;
  finalCodeIds: string[];
  motif: string;
  reconciledBy: string;
  reconciledAt: string;
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
  reconciliations: ReconciliationView[] = [],
): string {
  const documentById = new Map(documents.map((d) => [d.id, d]));
  const codeById = new Map(codes.map((c) => [c.id, c]));
  const reconciliationByCitation = new Map(reconciliations.map((r) => [r.citationId, r]));

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

  const renderPass = (stance: Stance, events: CodingEventView[]) => {
    const passEvents = events.filter((e) => e.stance === stance);
    lines.push(`**Passe ${stance} — ${STANCE_LABELS[stance]} :**`, "");
    if (passEvents.length === 0) {
      lines.push("- aucun codage", "");
      return;
    }
    for (const event of passEvents) {
      const code = codeById.get(event.codeId);
      lines.push(
        `- ${code ? `${code.code} « ${code.name} »` : event.codeId} · codeur ${event.coder} · ${event.createdAt}${
          event.memo ? ` · interprétation${event.memoCode ? ` (${event.memoCode})` : ""} : ${event.memo}` : ""
        }`,
      );
    }
    lines.push("");
  };

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

    renderPass("A", events);
    renderPass("B", events);

    const idsA = [...new Set(events.filter((e) => e.stance === "A").map((e) => e.codeId))];
    const idsB = [...new Set(events.filter((e) => e.stance === "B").map((e) => e.codeId))];
    const divergent =
      idsA.length > 0 && idsB.length > 0 && !(idsA.length === idsB.length && idsA.every((id) => idsB.includes(id)));

    const reconciliation = reconciliationByCitation.get(citation.id);
    if (reconciliation) {
      const finalNames = reconciliation.finalCodeIds
        .map((id) => {
          const code = codeById.get(id);
          return code ? `${code.code} « ${code.name} »` : id;
        })
        .join(" ; ");
      lines.push(`**Réconciliation ${reconciliation.code} :**`, "");
      lines.push(`- Décision : ${DECISION_LABELS[reconciliation.decision]}`);
      lines.push(`- Codage final : ${finalNames || "—"}`);
      lines.push(`- Motif : ${reconciliation.motif}`);
      lines.push(`- Réconcilié par ${reconciliation.reconciledBy} le ${reconciliation.reconciledAt}`, "");
    } else if (divergent) {
      lines.push("**STATUT : non réconcilié**", "");
    }

    lines.push("---", "");
  }

  return lines.join("\n");
}
