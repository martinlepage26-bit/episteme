import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { STANCE_LABELS, type SessionItem, type Stance } from "../lib/types";
import { Badge, Button, Input } from "./ui";

const STANCES: Stance[] = ["A", "B"];

export default function SessionBar({
  coder,
  stance,
  setStance,
  session,
  setSession,
}: {
  coder: string;
  stance: Stance;
  setStance: (stance: Stance) => void;
  session: SessionItem | null;
  setSession: (id: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState(false);
  const [project, setProject] = useState("");

  const open = useMutation({
    mutationFn: () => api.sessions.create({ project, coder: coder || "Anonyme", stance }),
    onSuccess: (created) => {
      setSession(created.id);
      setOpening(false);
      setProject("");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      queryClient.invalidateQueries({ queryKey: ["chain"] });
    },
  });

  const close = useMutation({
    mutationFn: () => api.sessions.end(session!.id),
    onSuccess: () => {
      setSession(null);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      queryClient.invalidateQueries({ queryKey: ["chain"] });
    },
  });

  // Une session ouverte porte la posture : on ne peut pas la changer en cours
  // de route sans clore la session, sinon le journal cesserait d'être exact.
  const stanceLocked = session !== null;
  const activeStance = session?.stance ?? stance;

  return (
    <div className="border-b border-ink/12 bg-ink/[0.03]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-ink/45">Posture</span>
          <div className="flex rounded-sm border border-ink/20">
            {STANCES.map((value) => (
              <button
                key={value}
                disabled={stanceLocked}
                onClick={() => setStance(value)}
                title={
                  stanceLocked ? "Close la session pour changer de posture" : `Passe ${value}`
                }
                className={`px-2.5 py-1 text-xs transition-colors first:rounded-l-sm last:rounded-r-sm ${
                  activeStance === value
                    ? "bg-ink text-paper"
                    : "text-ink/55 hover:bg-ink/5 disabled:hover:bg-transparent"
                } ${stanceLocked ? "cursor-not-allowed" : ""}`}
              >
                {value} — {STANCE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          {session ? (
            <>
              <Badge>{session.code}</Badge>
              <span className="text-xs text-ink/55">
                {session.project || "sans projet"} · {session.coder} · corpus {session.corpusSize} doc.
              </span>
              <Button variant="ghost" onClick={() => close.mutate()} disabled={close.isPending}>
                Clore la session
              </Button>
            </>
          ) : opening ? (
            <>
              <Input
                value={project}
                onChange={(event) => setProject(event.target.value)}
                placeholder="Nom du projet"
                className="w-52"
                autoFocus
              />
              <Button onClick={() => open.mutate()} disabled={open.isPending}>
                {open.isPending ? "Ouverture…" : `Ouvrir en passe ${stance}`}
              </Button>
              <Button variant="ghost" onClick={() => setOpening(false)}>
                Annuler
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-ink/40">Aucune session ouverte</span>
              <Button variant="secondary" onClick={() => setOpening(true)}>
                Ouvrir une session
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
