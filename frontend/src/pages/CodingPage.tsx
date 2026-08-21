import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Select, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { buildSegments, getSelectionOffsets } from "../lib/selection";

export default function CodingPage({ coder }: { coder: string }) {
  const { documentId } = useParams<{ documentId: string }>();
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  const documentQuery = useQuery({
    queryKey: ["documents", documentId],
    queryFn: () => api.documents.get(documentId!),
    enabled: !!documentId,
  });
  const citationsQuery = useQuery({
    queryKey: ["citations", documentId],
    queryFn: () => api.citations.list(documentId),
    enabled: !!documentId,
  });
  const codesQuery = useQuery({ queryKey: ["codes"], queryFn: api.codes.list });

  const [selectedCitationId, setSelectedCitationId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState("");
  const [memo, setMemo] = useState("");

  const codingEventsQuery = useQuery({
    queryKey: ["coding-events", selectedCitationId],
    queryFn: () => api.codingEvents.list({ citationId: selectedCitationId! }),
    enabled: !!selectedCitationId,
  });

  const createCitation = useMutation({
    mutationFn: () =>
      api.citations.create({
        documentId: documentId!,
        text: pendingSelection!.text,
        locationStart: pendingSelection!.start,
        locationEnd: pendingSelection!.end,
        createdBy: coder || "Anonyme",
      }),
    onSuccess: (citation) => {
      queryClient.invalidateQueries({ queryKey: ["citations", documentId] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      setPendingSelection(null);
      setSelectedCitationId(citation.id);
      window.getSelection()?.removeAllRanges();
    },
  });

  const applyCode = useMutation({
    mutationFn: () =>
      api.codingEvents.create({
        citationId: selectedCitationId!,
        codeId: selectedCodeId,
        coder: coder || "Anonyme",
        memo: memo || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coding-events", selectedCitationId] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      setSelectedCodeId("");
      setMemo("");
    },
  });

  const revokeCode = useMutation({
    mutationFn: (eventId: string) => api.codingEvents.revoke(eventId, coder || "Anonyme"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coding-events", selectedCitationId] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  if (!documentQuery.data) {
    return <p className="text-sm text-ink/50">Chargement…</p>;
  }

  const document = documentQuery.data;
  const citations = citationsQuery.data ?? [];
  const segments = buildSegments(document.content, citations);
  const selectedCitation = citations.find((c) => c.id === selectedCitationId) ?? null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link to="/corpus" className="text-xs text-ink/45 hover:text-ink">
            ← Corpus
          </Link>
          <h1 className="font-serif text-2xl">
            <Badge className="mr-2">{document.code}</Badge>
            {document.title}
          </h1>
          <p className="text-xs text-ink/50">{document.sourceType}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <Card>
            <div
              ref={contentRef}
              className="whitespace-pre-wrap font-mono text-sm leading-relaxed"
              onMouseUp={() => {
                if (!contentRef.current) return;
                setPendingSelection(getSelectionOffsets(contentRef.current));
              }}
            >
              {segments.map((segment, index) => (
                <span
                  key={index}
                  onClick={() => segment.citationId && setSelectedCitationId(segment.citationId)}
                  className={
                    segment.citationId
                      ? `cursor-pointer ${
                          segment.citationId === selectedCitationId ? "bg-ink/25" : "bg-ink/10 hover:bg-ink/20"
                        }`
                      : undefined
                  }
                >
                  {segment.text}
                </span>
              ))}
            </div>
          </Card>

          {pendingSelection && (
            <Card className="mt-3 border-ink/30 bg-ink/5">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink/50">Sélectionnez une citation</p>
              <p className="mb-3 text-sm italic">« {pendingSelection.text} »</p>
              <div className="flex gap-2">
                <Button disabled={!coder || createCitation.isPending} onClick={() => createCitation.mutate()}>
                  {createCitation.isPending ? "Création…" : "Ajoutez une citation pour démarrer le codage."}
                </Button>
                <Button variant="ghost" onClick={() => setPendingSelection(null)}>
                  Annuler
                </Button>
              </div>
              {!coder && <p className="mt-2 text-xs text-ink/45">Renseignez votre nom de codeur·e en haut à droite.</p>}
            </Card>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="mb-2 font-serif text-lg">Citations codées</h2>
            {citations.length === 0 && <EmptyState>Aucune citation. Sélectionnez du texte à gauche.</EmptyState>}
            <ul className="space-y-1.5">
              {citations.map((citation) => (
                <li key={citation.id}>
                  <button
                    onClick={() => setSelectedCitationId(citation.id)}
                    className={`w-full rounded-sm border px-2.5 py-1.5 text-left text-sm ${
                      citation.id === selectedCitationId
                        ? "border-ink/40 bg-ink/5"
                        : "border-ink/12 hover:border-ink/25"
                    }`}
                  >
                    <Badge className="mr-2">{citation.code}</Badge>
                    <span className="text-ink/70">
                      {citation.text.length > 60 ? `${citation.text.slice(0, 60)}…` : citation.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selectedCitation && (
            <Card>
              <p className="mb-1 text-xs uppercase tracking-wide text-ink/50">{selectedCitation.code}</p>
              <p className="mb-3 text-sm italic">« {selectedCitation.text} »</p>

              <div className="mb-3 space-y-1.5">
                {(codingEventsQuery.data ?? []).filter((e) => !e.revoked).length === 0 && (
                  <p className="text-xs text-ink/45">Aucun événement</p>
                )}
                {(codingEventsQuery.data ?? [])
                  .filter((e) => !e.revoked)
                  .map((event) => {
                    const code = codesQuery.data?.find((c) => c.id === event.codeId);
                    return (
                      <div key={event.id} className="flex items-center justify-between rounded-sm border border-ink/12 px-2 py-1 text-sm">
                        <span>
                          {code ? `${code.code} — ${code.name}` : event.codeId}
                          {event.memo && <span className="ml-2 text-xs text-ink/45">· {event.memo}</span>}
                        </span>
                        <Button variant="ghost" onClick={() => revokeCode.mutate(event.id)}>
                          Révoquer
                        </Button>
                      </div>
                    );
                  })}
              </div>

              <div className="space-y-2 border-t border-ink/10 pt-3">
                <Select value={selectedCodeId} onChange={(e) => setSelectedCodeId(e.target.value)}>
                  <option value="">Choisir un code…</option>
                  {codesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
                <Textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Mémo d'interprétation (optionnel)"
                  rows={2}
                />
                <Button
                  disabled={!selectedCodeId || !coder || applyCode.isPending}
                  onClick={() => applyCode.mutate()}
                >
                  Ajouter un événement de codage
                </Button>
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
