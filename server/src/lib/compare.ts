import { collections } from "../db.js";
import type { Stance } from "../types.js";

/** Codes actifs (non révoqués) appliqués à une citation, séparés par posture. */
export async function activeCodeIdsByStance(
  citationId: string,
): Promise<Record<Stance, string[]>> {
  const events = await collections.codingEvents.find({ citationId, revoked: false }).toArray();
  const out: Record<Stance, string[]> = { A: [], B: [] };
  for (const event of events) {
    const stance: Stance = event.stance === "B" ? "B" : "A";
    if (!out[stance].includes(event.codeId)) out[stance].push(event.codeId);
  }
  return out;
}

export interface CitationComparison {
  citationId: string;
  citationCode: string;
  documentCode: string;
  text: string;
  passA: { codeId: string; codeCode: string; codeName: string; memo: string }[];
  passB: { codeId: string; codeCode: string; codeName: string; memo: string }[];
  /** Aucun code commun entre les deux passes, les deux étant non vides. */
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

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * Calcule le bilan Pass A → Pass B (SPEC §3).
 *
 * Toutes les mesures sont factuelles et se lisent sur les ensembles de codes
 * actifs par citation. L'outil ne qualifie pas ces écarts : il les compte, et
 * laisse au chercheur le soin de les interpréter.
 */
export async function buildComparison(): Promise<ComparisonResult> {
  const [citations, documents, codes, events, reconciliations] = await Promise.all([
    collections.citations.find().sort({ createdAt: 1 }).toArray(),
    collections.documents.find().toArray(),
    collections.codes.find().toArray(),
    collections.codingEvents.find({ revoked: false }).toArray(),
    collections.reconciliations.find().toArray(),
  ]);

  const documentByHex = new Map(documents.map((d) => [d._id!.toHexString(), d]));
  const codeByHex = new Map(codes.map((c) => [c._id!.toHexString(), c]));
  const reconciliationByCitation = new Map(reconciliations.map((r) => [r.citationId, r]));

  const byCitation = new Map<string, Record<Stance, typeof events>>();
  for (const event of events) {
    if (!byCitation.has(event.citationId)) byCitation.set(event.citationId, { A: [], B: [] });
    const stance: Stance = event.stance === "B" ? "B" : "A";
    byCitation.get(event.citationId)![stance].push(event);
  }

  const codesInPass: Record<Stance, Set<string>> = { A: new Set(), B: new Set() };
  const citationsInPass: Record<Stance, Set<string>> = { A: new Set(), B: new Set() };
  const contradictionsInPass: Record<Stance, number> = { A: 0, B: 0 };

  let interpretationChanged = 0;
  let secondCodeAdded = 0;
  let originalCodeLost = 0;
  let contradictionsRevealed = 0;
  let reconciled = 0;
  let unreconciled = 0;

  const details: CitationComparison[] = [];

  for (const citation of citations) {
    const citationId = citation._id!.toHexString();
    const buckets = byCitation.get(citationId) ?? { A: [], B: [] };

    const idsA = [...new Set(buckets.A.map((e) => e.codeId))];
    const idsB = [...new Set(buckets.B.map((e) => e.codeId))];
    if (idsA.length === 0 && idsB.length === 0) continue;

    for (const stance of ["A", "B"] as Stance[]) {
      const ids = stance === "A" ? idsA : idsB;
      if (ids.length > 0) citationsInPass[stance].add(citationId);
      ids.forEach((id) => codesInPass[stance].add(id));
    }

    const bothCoded = idsA.length > 0 && idsB.length > 0;
    const divergent = bothCoded && !sameSet(idsA, idsB);
    const contradiction = bothCoded && idsA.every((id) => !idsB.includes(id));

    if (divergent) interpretationChanged += 1;
    if (bothCoded && idsA.every((id) => idsB.includes(id)) && idsB.length > idsA.length) {
      secondCodeAdded += 1;
    }
    if (bothCoded && idsA.some((id) => !idsB.includes(id))) originalCodeLost += 1;
    if (contradiction) {
      contradictionsRevealed += 1;
      contradictionsInPass.A += 1;
      contradictionsInPass.B += 1;
    }

    const reconciliation = reconciliationByCitation.get(citationId) ?? null;
    if (divergent) {
      if (reconciliation) reconciled += 1;
      else unreconciled += 1;
    }

    const view = (bucket: typeof events) =>
      [...new Map(bucket.map((e) => [e.codeId, e])).values()].map((event) => {
        const code = codeByHex.get(event.codeId);
        return {
          codeId: event.codeId,
          codeCode: code?.code ?? "—",
          codeName: code?.name ?? event.codeId,
          memo: event.memo ?? "",
        };
      });

    details.push({
      citationId,
      citationCode: citation.code,
      documentCode: documentByHex.get(citation.documentId)?.code ?? "—",
      text: citation.text,
      passA: view(buckets.A),
      passB: view(buckets.B),
      contradiction,
      divergent,
      reconciliationCode: reconciliation?.code ?? null,
    });
  }

  const emergent = (stance: Stance) => {
    const other: Stance = stance === "A" ? "B" : "A";
    return [...codesInPass[stance]]
      .filter((id) => !codesInPass[other].has(id))
      .map((id) => ({
        code: codeByHex.get(id)?.code ?? "—",
        name: codeByHex.get(id)?.name ?? id,
      }));
  };

  const emergentThemes = { A: emergent("A"), B: emergent("B") };

  return {
    table: {
      citations: { A: citationsInPass.A.size, B: citationsInPass.B.size },
      codesUsed: { A: codesInPass.A.size, B: codesInPass.B.size },
      emergentThemes,
      contradictions: contradictionsInPass,
    },
    delta: {
      interpretationChanged,
      secondCodeAdded,
      originalCodeLost,
      newThemes: emergentThemes.B.length,
      contradictionsRevealed,
      reconciled,
      unreconciled,
    },
    citations: details,
  };
}
