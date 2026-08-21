import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge, Card, EmptyState } from "../components/ui";
import { api } from "../lib/api";
import { STANCE_LABELS, type CitationComparison } from "../lib/types";

function ThemeList({ themes }: { themes: { code: string; name: string }[] }) {
  if (themes.length === 0) return <span className="text-ink/35">—</span>;
  return (
    <span className="space-x-1">
      {themes.map((theme) => (
        <Badge key={theme.code}>{theme.name}</Badge>
      ))}
    </span>
  );
}

function DeltaLine({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-1">
      <span className="w-8 shrink-0 text-right font-mono tabular-nums text-ink">{count}</span>
      <span className="text-ink/70">{children}</span>
    </li>
  );
}

function CitationRow({ citation }: { citation: CitationComparison }) {
  const render = (entries: CitationComparison["passA"]) =>
    entries.length === 0 ? (
      <span className="text-ink/35">—</span>
    ) : (
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.codeId}>
            <span className="font-medium">{entry.codeName}</span>
            {entry.memo && <span className="block text-xs text-ink/50">{entry.memo}</span>}
          </li>
        ))}
      </ul>
    );

  return (
    <tr className="border-b border-ink/8 align-top last:border-0">
      <td className="px-3 py-2.5">
        <Badge>{citation.citationCode}</Badge>
        <p className="mt-1 text-xs italic text-ink/55">
          {citation.text.length > 90 ? `${citation.text.slice(0, 90)}…` : citation.text}
        </p>
      </td>
      <td className="px-3 py-2.5">{render(citation.passA)}</td>
      <td className="px-3 py-2.5">{render(citation.passB)}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-xs">
        {citation.reconciliationCode ? (
          <span className="text-ink/60">Réconcilié · {citation.reconciliationCode}</span>
        ) : citation.contradiction ? (
          <span className="text-red-800">Contradiction · non réconcilié</span>
        ) : citation.divergent ? (
          <span className="text-ink/70">Divergent · non réconcilié</span>
        ) : (
          <span className="text-ink/35">Concordant</span>
        )}
      </td>
    </tr>
  );
}

export default function ComparePage() {
  const compareQuery = useQuery({ queryKey: ["compare"], queryFn: api.compare.get });

  if (compareQuery.isLoading) return <p className="text-sm text-ink/50">Chargement…</p>;
  const data = compareQuery.data;
  if (!data) return <EmptyState>Comparaison indisponible</EmptyState>;

  const { table, delta, citations } = data;
  const divergent = citations.filter((citation) => citation.divergent);

  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl">Comparaison des passes</h1>
      <p className="mb-6 max-w-3xl text-sm text-ink/50">
        Les deux postures ne sont pas fusionnées. L'écart entre elles est conservé comme donnée
        d'analyse : l'outil le mesure, il ne l'interprète pas.
      </p>

      <div className="mb-6 overflow-x-auto rounded-md border border-ink/12">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="border-b border-ink/12 bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-3 py-2">Élément</th>
              <th className="px-3 py-2">Passe A — {STANCE_LABELS.A}</th>
              <th className="px-3 py-2">Passe B — {STANCE_LABELS.B}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink/8">
              <th className="px-3 py-2 text-left font-medium">Citations codées</th>
              <td className="px-3 py-2 font-mono tabular-nums">{table.citations.A}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{table.citations.B}</td>
            </tr>
            <tr className="border-b border-ink/8">
              <th className="px-3 py-2 text-left font-medium">Codes distincts employés</th>
              <td className="px-3 py-2 font-mono tabular-nums">{table.codesUsed.A}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{table.codesUsed.B}</td>
            </tr>
            <tr className="border-b border-ink/8">
              <th className="px-3 py-2 text-left font-medium">Thèmes propres à la passe</th>
              <td className="px-3 py-2">
                <ThemeList themes={table.emergentThemes.A} />
              </td>
              <td className="px-3 py-2">
                <ThemeList themes={table.emergentThemes.B} />
              </td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium">Contradictions identifiées</th>
              <td className="px-3 py-2 font-mono tabular-nums">{table.contradictions.A}</td>
              <td className="px-3 py-2 font-mono tabular-nums">{table.contradictions.B}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Card className="mb-6">
        <h2 className="mb-1 font-serif text-lg">Δ épistémique</h2>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink/45">
          Passe A → Passe B ({STANCE_LABELS.B})
        </p>
        <ul className="text-sm">
          <DeltaLine count={delta.interpretationChanged}>
            citation(s) ont vu leur interprétation modifiée
          </DeltaLine>
          <DeltaLine count={delta.secondCodeAdded}>
            citation(s) ont reçu un second code (nuance ajoutée)
          </DeltaLine>
          <DeltaLine count={delta.originalCodeLost}>
            citation(s) ont perdu leur code d'origine
          </DeltaLine>
          <DeltaLine count={delta.newThemes}>
            nouveau(x) thème(s) sont apparus en passe B
          </DeltaLine>
          <DeltaLine count={delta.contradictionsRevealed}>
            contradiction(s) jusque-là masquée(s) ont été identifiées
          </DeltaLine>
        </ul>
        <p className="mt-3 border-t border-ink/10 pt-3 text-sm text-ink/60">
          {delta.reconciled} divergence(s) réconciliée(s) · {delta.unreconciled} en attente
          {delta.unreconciled > 0 && (
            <>
              {" — "}
              <Link to="/reconcile" className="underline underline-offset-2 hover:text-ink">
                réconcilier
              </Link>
            </>
          )}
        </p>
      </Card>

      <h2 className="mb-2 font-serif text-lg">
        Citations divergentes{" "}
        <span className="font-sans text-sm text-ink/45">({divergent.length})</span>
      </h2>
      {divergent.length === 0 ? (
        <EmptyState>
          Aucune divergence entre les deux passes. Codez la même citation sous les deux postures pour
          faire apparaître un écart.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-md border border-ink/12">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-ink/12 bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-3 py-2">Citation</th>
                <th className="px-3 py-2">Passe A</th>
                <th className="px-3 py-2">Passe B</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {divergent.map((citation) => (
                <CitationRow key={citation.citationId} citation={citation} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
