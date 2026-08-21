import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import SessionBar from "./components/SessionBar";
import { Badge, Button, Input } from "./components/ui";
import { api } from "./lib/api";
import { useActiveSession, useCoder, useStance } from "./lib/useCoder";
import AuditPage from "./pages/AuditPage";
import CodebookPage from "./pages/CodebookPage";
import CodingPage from "./pages/CodingPage";
import ComparePage from "./pages/ComparePage";
import CorpusPage from "./pages/CorpusPage";
import ExportsPage from "./pages/ExportsPage";
import ReconcilePage from "./pages/ReconcilePage";

const NAV_ITEMS = [
  { to: "/corpus", label: "Corpus" },
  { to: "/codebook", label: "Codebook" },
  { to: "/compare", label: "Comparer" },
  { to: "/reconcile", label: "Réconcilier" },
  { to: "/audit", label: "Audit" },
  { to: "/exports", label: "Exports" },
];

export default function App() {
  const queryClient = useQueryClient();
  const [coder, setCoder] = useCoder();
  const [stance, setStance] = useStance();
  const { session, setSession } = useActiveSession();

  const authQuery = useQuery({ queryKey: ["auth-status"], queryFn: api.auth.status });
  const identityEmail = authQuery.data?.method === "access" ? authQuery.data.email : null;

  // Sous Access, l'identité est attestée : elle sert de nom de codeur·e par
  // défaut, pour que le journal d'audit porte une personne vérifiée plutôt
  // qu'un nom saisi à la main.
  useEffect(() => {
    if (identityEmail && !coder) setCoder(identityEmail);
  }, [identityEmail, coder, setCoder]);

  // La session ouverte fait foi sur la posture : les pages de codage lisent
  // celle-ci, jamais la préférence locale, tant qu'une session est ouverte.
  const activeStance = session?.stance ?? stance;

  const logout = async () => {
    await api.auth.logout();
    queryClient.clear();
    // Sous Access, se déconnecter de l'origine ne suffit pas : c'est la session
    // Cloudflare qui fait entrer.
    if (authQuery.data?.method === "access") {
      window.location.href = "/cdn-cgi/access/logout";
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["auth-status"] });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/12 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex flex-wrap items-baseline gap-6">
            <span className="font-serif text-lg italic tracking-tight">Épistémè</span>
            <nav className="flex flex-wrap gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-sm px-2.5 py-1 text-sm ${
                      isActive ? "bg-ink text-paper" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-ink/45">Codeur·e</span>
            <Input
              value={coder}
              onChange={(event) => setCoder(event.target.value)}
              placeholder="votre nom"
              className="w-40"
            />
            {identityEmail && (
              <Badge className="max-w-[14rem] truncate" >{identityEmail}</Badge>
            )}
            <Button variant="ghost" onClick={logout}>
              Quitter
            </Button>
          </div>
        </div>
      </header>

      <SessionBar
        coder={coder}
        stance={stance}
        setStance={setStance}
        session={session}
        setSession={setSession}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<CorpusPage coder={coder} />} />
          <Route path="/corpus" element={<CorpusPage coder={coder} />} />
          <Route
            path="/coding/:documentId"
            element={
              <CodingPage coder={coder} stance={activeStance} sessionId={session?.id ?? null} />
            }
          />
          <Route path="/codebook" element={<CodebookPage coder={coder} />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/reconcile" element={<ReconcilePage coder={coder} />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/exports" element={<ExportsPage coder={coder} />} />
        </Routes>
      </main>
    </div>
  );
}
