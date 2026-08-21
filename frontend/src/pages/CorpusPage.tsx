import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Input, Label, Textarea } from "../components/ui";
import { api } from "../lib/api";

export default function CorpusPage({ coder }: { coder: string }) {
  const queryClient = useQueryClient();
  const documentsQuery = useQuery({ queryKey: ["documents"], queryFn: api.documents.list });

  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("Entretien semi-directif");
  const [note, setNote] = useState("");
  const [content, setContent] = useState("");

  const createDocument = useMutation({
    mutationFn: () =>
      api.documents.create({
        title,
        sourceType,
        metadata: note ? { note } : {},
        content,
        createdBy: coder || "Anonyme",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      setTitle("");
      setNote("");
      setContent("");
    },
  });

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
      <section>
        <h1 className="mb-4 font-serif text-2xl">Corpus</h1>
        {documentsQuery.isLoading && <p className="text-sm text-ink/50">Chargement…</p>}
        {documentsQuery.data && documentsQuery.data.length === 0 && (
          <EmptyState>Aucun document. Ajoutez-en un pour commencer le codage.</EmptyState>
        )}
        <ul className="space-y-2">
          {documentsQuery.data?.map((doc) => (
            <li key={doc.id}>
              <Link to={`/coding/${doc.id}`}>
                <Card className="transition-colors hover:border-ink/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge>{doc.code}</Badge>
                        <span className="font-medium">{doc.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink/50">
                        {doc.sourceType || "—"} · créé par {doc.createdBy} · {new Date(doc.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <span className="text-xs text-ink/40">{doc.content.length.toLocaleString("fr-FR")} car.</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl">Créer le document</h2>
        <Card className="space-y-3">
          <div>
            <Label htmlFor="title">Titre</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="INT_17" />
          </div>
          <div>
            <Label htmlFor="sourceType">Type de source</Label>
            <Input
              id="sourceType"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              placeholder="Entretien semi-directif · date · durée"
            />
          </div>
          <div>
            <Label htmlFor="note">Métadonnées (libre)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Participant, date, durée…" />
          </div>
          <div>
            <Label htmlFor="content">Contenu</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="Collez le texte de l'entretien ou du document ici."
            />
          </div>
          {createDocument.isError && (
            <p className="text-sm text-red-700">{(createDocument.error as Error).message}</p>
          )}
          <Button
            disabled={!title || !content || !coder || createDocument.isPending}
            onClick={() => createDocument.mutate()}
          >
            {createDocument.isPending ? "Création…" : "Créer le document"}
          </Button>
          {!coder && <p className="text-xs text-ink/45">Renseignez votre nom de codeur·e en haut à droite.</p>}
        </Card>
      </section>
    </div>
  );
}
