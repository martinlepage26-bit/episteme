import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, EmptyState, Input, Select } from "../components/ui";
import { api } from "../lib/api";
import type { AuditEventType, ChainVerification } from "../lib/types";

const TYPE_LABELS: Record<AuditEventType, string> = {
  DOCUMENT_CREATED: "Document créé",
  CITATION_CREATED: "Citation créée",
  CODE_CREATED: "Code créé",
  CODE_UPDATED: "Code modifié",
  CODE_APPLIED: "Code appliqué",
  CODE_REVOKED: "Code révoqué",
  MEMO_CREATED: "Mémo créé",
  SESSION_STARTED: "Session ouverte",
  SESSION_ENDED: "Session close",
  CONFLICT_DETECTED: "Conflit 2ᵉ codeur",
  RECONCILIATION: "Réconciliation",
};

function ChainBanner({ chain }: { chain: ChainVerification }) {
  if (chain.status === "empty") {
    return (
      <Card className="mb-4">
        <p className="text-sm text-ink/50">Chaîne vide — aucun événement enregistré.</p>
      </Card>
    );
  }

  if (chain.status === "broken") {
    return (
      <Card className="mb-4 border-red-700/40 bg-red-50">
        <p className="text-sm font-medium text-red-900">Chaîne rompue au rang {chain.firstBrokenSeq}</p>
        <p className="mt-1 text-sm text-red-800">{chain.reason}</p>
        <p className="mt-2 text-xs text-red-800/70">
          Les événements postérieurs à ce rang ne peuvent plus être attestés.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium">Chaîne vérifiée</span>
          <span className="text-ink/55"> — {chain.eventCount} événement(s), SHA-256 recalculé de bout en bout.</span>
        </p>
        <p className="font-mono text-[11px] text-ink/45" title={chain.headHash ?? undefined}>
          empreinte de tête : {chain.headHash?.slice(0, 16)}…
        </p>
      </div>
    </Card>
  );
}

export default function AuditPage() {
  const [type, setType] = useState("");
  const [actor, setActor] = useState("");
  const [stance, setStance] = useState("");

  const chainQuery = useQuery({ queryKey: ["chain"], queryFn: api.audit.verify });
  const auditQuery = useQuery({
    queryKey: ["audit", type, actor, stance],
    queryFn: () =>
      api.audit.list({
        ...(type ? { type } : {}),
        ...(actor ? { actor } : {}),
        ...(stance ? { stance } : {}),
      }),
  });

  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl">Journal d'audit</h1>
      <p className="mb-4 max-w-3xl text-sm text-ink/50">
        Append-only et chaîné : chaque événement porte l'empreinte du précédent. Retirer, réordonner
        ou modifier un événement rompt la chaîne de façon détectable.
      </p>

      {chainQuery.data && <ChainBanner chain={chainQuery.data} />}

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={type} onChange={(event) => setType(event.target.value)} className="w-56">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={stance} onChange={(event) => setStance(event.target.value)} className="w-52">
          <option value="">Toutes les postures</option>
          <option value="A">Passe A — interprétation</option>
          <option value="B">Passe B — contraste</option>
        </Select>
        <Input
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          placeholder="Filtrer par codeur·e"
          className="w-56"
        />
      </div>

      {auditQuery.data && auditQuery.data.length === 0 && <EmptyState>Aucun événement</EmptyState>}

      <div className="overflow-x-auto rounded-md border border-ink/12">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-ink/12 bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-3 py-2">Rang</th>
              <th className="px-3 py-2">Horodatage</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Codeur·e</th>
              <th className="px-3 py-2">Résumé</th>
              <th className="px-3 py-2">Empreinte</th>
            </tr>
          </thead>
          <tbody>
            {auditQuery.data?.map((event) => (
              <tr key={event.id} className="border-b border-ink/8 align-top last:border-0">
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink/45">{event.seq}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink/60">
                  {new Date(event.timestamp).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2">
                  <Badge>{TYPE_LABELS[event.type]}</Badge>
                  {event.stance && <Badge className="ml-1">passe {event.stance}</Badge>}
                </td>
                <td className="px-3 py-2 text-ink/70">{event.actor}</td>
                <td className="px-3 py-2">{event.summary}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-ink/40" title={event.hash}>
                  {event.hash?.slice(0, 10)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
