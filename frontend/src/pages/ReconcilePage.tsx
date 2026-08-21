import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Label, Select, Textarea } from "../components/ui";
import { api } from "../lib/api";
import {
  DECISION_LABELS,
  STANCE_LABELS,
  type CitationComparison,
  type ReconciliationDecision,
} from "../lib/types";

const DECISIONS = Object.keys(DECISION_LABELS) as ReconciliationDecision[];

function PassColumn({
  stance,
  entries,
}: {
  stance: "A" | "B";
  entries: CitationComparison["passA"];
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-wide text-ink/45">
        Passe {stance} — {STANCE_LABELS[stance]}
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-ink/35">aucun codage</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.codeId} className="rounded-sm border border-ink/12 px-2 py-1.5">
              <span className="text-sm font-medium">{entry.codeName}</span>
              <Badge className="ml-2">{entry.codeCode}</Badge>
              {entry.memo && <p className="mt-0.5 text-xs italic text-ink/55">{entry.memo}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReconcileForm({
  citation,
  coder,
  onDone,
}: {
  citation: CitationComparison;
  coder: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<ReconciliationDecision>("keep_both");
  const [motif, setMotif] = useState("");
  const [finalCodeIds, setFinalCodeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const available = [...citation.passA, ...citation.passB].filter(
    (entry, index, all) => all.findIndex((other) => other.codeId === entry.codeId) === index,
  );

  const submit = useMutation({
    mutationFn: () =>
      api.reconciliations.create({
        citationId: citation.citationId,
        decision,
        finalCodeIds: decision === "new_code" ? finalCodeIds : [],
        motif,
        reconciledBy: coder || "Anonyme",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compare"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      queryClient.invalidateQueries({ queryKey: ["chain"] });
      onDone();
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : "Échec"),
  });

  return (
    <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
      <div>
        <Label>Décision</Label>
        <Select value={decision} onChange={(event) => setDecision(event.target.value as ReconciliationDecision)}>
          {DECISIONS.map((value) => (
            <option key={value} value={value}>
              {DECISION_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      {decision === "new_code" && (
        <div>
          <Label>Codage final</Label>
          <div className="space-y-1">
            {available.map((entry) => (
              <label key={entry.codeId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={finalCodeIds.includes(entry.codeId)}
                  onChange={(event) =>
                    setFinalCodeIds((current) =>
                      event.target.checked
                        ? [...current, entry.codeId]
                        : current.filter((id) => id !== entry.codeId),
                    )
                  }
                />
                {entry.codeName}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label>Motif</Label>
        <Textarea
          rows={2}
          value={motif}
          onChange={(event) => setMotif(event.target.value)}
          placeholder="Pourquoi cette décision ? Ce motif est inscrit au journal."
        />
      </div>

      {error && <p className="text-sm text-red-800">{error}</p>}

      <Button
        disabled={!motif || submit.isPending || (decision === "new_code" && finalCodeIds.length === 0)}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? "Enregistrement…" : "Enregistrer la réconciliation"}
      </Button>
    </div>
  );
}

export default function ReconcilePage({ coder }: { coder: string }) {
  const compareQuery = useQuery({ queryKey: ["compare"], queryFn: api.compare.get });
  const [openId, setOpenId] = useState<string | null>(null);

  if (compareQuery.isLoading) return <p className="text-sm text-ink/50">Chargement…</p>;

  const citations = (compareQuery.data?.citations ?? []).filter((citation) => citation.divergent);
  const pending = citations.filter((citation) => !citation.reconciliationCode);
  const done = citations.filter((citation) => citation.reconciliationCode);

  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl">Réconciliation</h1>
      <p className="mb-6 max-w-3xl text-sm text-ink/50">
        Réconcilier n'est pas trancher : c'est enregistrer une décision et sa raison. Les deux
        lectures d'origine restent inscrites au journal, quelle que soit la décision.
      </p>

      <h2 className="mb-2 font-serif text-lg">
        En attente <span className="font-sans text-sm text-ink/45">({pending.length})</span>
      </h2>
      {pending.length === 0 ? (
        <EmptyState>Aucune divergence en attente de réconciliation.</EmptyState>
      ) : (
        <div className="space-y-3">
          {pending.map((citation) => (
            <Card key={citation.citationId}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge>{citation.citationCode}</Badge>
                  <Badge className="ml-1.5">{citation.documentCode}</Badge>
                  {citation.contradiction && (
                    <span className="ml-2 text-xs text-red-800">aucun code commun</span>
                  )}
                  <p className="mt-1.5 text-sm italic text-ink/70">« {citation.text} »</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setOpenId(openId === citation.citationId ? null : citation.citationId)}
                >
                  {openId === citation.citationId ? "Fermer" : "Réconcilier"}
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PassColumn stance="A" entries={citation.passA} />
                <PassColumn stance="B" entries={citation.passB} />
              </div>

              {openId === citation.citationId && (
                <ReconcileForm citation={citation} coder={coder} onDone={() => setOpenId(null)} />
              )}
            </Card>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 font-serif text-lg">
            Réconciliées <span className="font-sans text-sm text-ink/45">({done.length})</span>
          </h2>
          <div className="space-y-2">
            {done.map((citation) => (
              <Card key={citation.citationId} className="bg-white/40">
                <div className="flex items-center gap-2">
                  <Badge>{citation.citationCode}</Badge>
                  <Badge>{citation.reconciliationCode}</Badge>
                  <span className="text-sm italic text-ink/60">
                    {citation.text.length > 80 ? `${citation.text.slice(0, 80)}…` : citation.text}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
