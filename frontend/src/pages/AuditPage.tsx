import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, EmptyState, Input, Select } from "../components/ui";
import { api } from "../lib/api";
import type { AuditEventType } from "../lib/types";

const TYPE_LABELS: Record<AuditEventType, string> = {
  DOCUMENT_CREATED: "Document créé",
  CITATION_CREATED: "Citation créée",
  CODE_CREATED: "Code créé",
  CODE_UPDATED: "Code modifié",
  CODE_APPLIED: "Code appliqué",
  CODE_REVOKED: "Code révoqué",
  MEMO_CREATED: "Mémo créé",
};

export default function AuditPage() {
  const [type, setType] = useState("");
  const [actor, setActor] = useState("");

  const auditQuery = useQuery({
    queryKey: ["audit", type, actor],
    queryFn: () =>
      api.audit.list({
        ...(type ? { type } : {}),
        ...(actor ? { actor } : {}),
      }),
  });

  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl">Journal d'audit</h1>
      <p className="mb-4 text-sm text-ink/50">
        Append-only — chaque événement est horodaté et lié à l'objet concerné. Aucune modification ni suppression n'est possible ici.
      </p>

      <div className="mb-4 flex gap-3">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-56">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Filtrer par codeur·e" className="w-56" />
      </div>

      {auditQuery.data && auditQuery.data.length === 0 && <EmptyState>Aucun événement</EmptyState>}

      <div className="overflow-hidden rounded-md border border-ink/12">
        <table className="w-full text-sm">
          <thead className="border-b border-ink/12 bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-3 py-2">Horodatage</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Codeur·e</th>
              <th className="px-3 py-2">Résumé</th>
            </tr>
          </thead>
          <tbody>
            {auditQuery.data?.map((event) => (
              <tr key={event.id} className="border-b border-ink/8 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink/60">
                  {new Date(event.timestamp).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2">
                  <Badge>{TYPE_LABELS[event.type]}</Badge>
                </td>
                <td className="px-3 py-2 text-ink/70">{event.actor}</td>
                <td className="px-3 py-2">{event.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
