import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Label, Select, Textarea } from "../components/ui";
import { api } from "../lib/api";
import type { CodeItem } from "../lib/types";

function useCodeTree(codes: CodeItem[] | undefined) {
  return useMemo(() => {
    if (!codes) return [];
    const byParent = new Map<string | null, CodeItem[]>();
    for (const code of codes) {
      const key = code.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(code);
    }
    const roots = byParent.get(null) ?? [];
    const withDepth: { code: CodeItem; depth: number }[] = [];
    const visit = (nodes: CodeItem[], depth: number) => {
      for (const node of nodes) {
        withDepth.push({ code: node, depth });
        visit(byParent.get(node.id) ?? [], depth + 1);
      }
    };
    visit(roots, 0);
    return withDepth;
  }, [codes]);
}

export default function CodebookPage({ coder }: { coder: string }) {
  const queryClient = useQueryClient();
  const codesQuery = useQuery({ queryKey: ["codes"], queryFn: api.codes.list });
  const tree = useCodeTree(codesQuery.data);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [inclusionCriteria, setInclusionCriteria] = useState("");
  const [exclusionCriteria, setExclusionCriteria] = useState("");
  const [example, setExample] = useState("");
  const [parentId, setParentId] = useState<string>("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDefinition("");
    setInclusionCriteria("");
    setExclusionCriteria("");
    setExample("");
    setParentId("");
  };

  const createCode = useMutation({
    mutationFn: () =>
      api.codes.create({
        name,
        definition,
        inclusionCriteria,
        exclusionCriteria,
        example,
        parentId: parentId || null,
        createdBy: coder || "Anonyme",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codes"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      resetForm();
    },
  });

  const updateCode = useMutation({
    mutationFn: () =>
      api.codes.update(editingId!, {
        name,
        definition,
        inclusionCriteria,
        exclusionCriteria,
        example,
        parentId: parentId || null,
        changedBy: coder || "Anonyme",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codes"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      resetForm();
    },
  });

  const startEdit = (code: CodeItem) => {
    setEditingId(code.id);
    setName(code.name);
    setDefinition(code.definition);
    setInclusionCriteria(code.inclusionCriteria);
    setExclusionCriteria(code.exclusionCriteria);
    setExample(code.example);
    setParentId(code.parentId ?? "");
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
      <section>
        <h1 className="mb-4 font-serif text-2xl">Codebook</h1>
        {codesQuery.data && codesQuery.data.length === 0 && (
          <EmptyState>Aucun code. Créez-en un pour commencer à coder des citations.</EmptyState>
        )}
        <ul className="space-y-2">
          {tree.map(({ code, depth }) => (
            <li key={code.id} style={{ marginLeft: depth * 24 }}>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge>{code.code}</Badge>
                      <span className="font-medium">{code.name}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink/70">{code.definition || "—"}</p>
                    {(code.inclusionCriteria || code.exclusionCriteria) && (
                      <p className="mt-1 text-xs text-ink/50">
                        {code.inclusionCriteria && <>Inclusion : {code.inclusionCriteria} </>}
                        {code.exclusionCriteria && <>· Exclusion : {code.exclusionCriteria}</>}
                      </p>
                    )}
                    {code.example && <p className="mt-1 text-xs italic text-ink/45">« {code.example} »</p>}
                  </div>
                  <Button variant="ghost" onClick={() => startEdit(code)}>
                    Modifier
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl">{editingId ? "Modifier le code" : "Nouveau code"}</h2>
        <Card className="space-y-3">
          <div>
            <Label htmlFor="name">Nom</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="definition">Définition analytique du code</Label>
            <Textarea id="definition" value={definition} onChange={(e) => setDefinition(e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor="inclusion">Critères d'inclusion</Label>
            <Textarea id="inclusion" value={inclusionCriteria} onChange={(e) => setInclusionCriteria(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="exclusion">Critères d'exclusion</Label>
            <Textarea id="exclusion" value={exclusionCriteria} onChange={(e) => setExclusionCriteria(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="example">Exemple d'énoncé</Label>
            <Textarea id="example" value={example} onChange={(e) => setExample(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="parent">Code parent</Label>
            <Select id="parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— aucun —</option>
              {codesQuery.data
                ?.filter((c) => c.id !== editingId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
            </Select>
          </div>
          {(createCode.isError || updateCode.isError) && (
            <p className="text-sm text-red-700">
              {((createCode.error ?? updateCode.error) as Error).message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              disabled={!name || !definition || !coder || createCode.isPending || updateCode.isPending}
              onClick={() => (editingId ? updateCode.mutate() : createCode.mutate())}
            >
              {editingId ? "Enregistrer" : "Créer le code"}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={resetForm}>
                Annuler
              </Button>
            )}
          </div>
          {!coder && <p className="text-xs text-ink/45">Renseignez votre nom de codeur·e en haut à droite.</p>}
        </Card>
      </section>
    </div>
  );
}
