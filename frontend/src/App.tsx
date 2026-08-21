import { NavLink, Route, Routes } from "react-router-dom";
import { Input } from "./components/ui";
import { useCoder } from "./lib/useCoder";
import AuditPage from "./pages/AuditPage";
import CodebookPage from "./pages/CodebookPage";
import CodingPage from "./pages/CodingPage";
import CorpusPage from "./pages/CorpusPage";
import ExportsPage from "./pages/ExportsPage";

const NAV_ITEMS = [
  { to: "/corpus", label: "Corpus" },
  { to: "/codebook", label: "Codebook" },
  { to: "/audit", label: "Audit" },
  { to: "/exports", label: "Exports" },
];

export default function App() {
  const [coder, setCoder] = useCoder();

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/12 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-6">
            <span className="font-serif text-lg italic tracking-tight">Épistémè</span>
            <nav className="flex gap-1">
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
              onChange={(e) => setCoder(e.target.value)}
              placeholder="votre nom"
              className="w-40"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<CorpusPage coder={coder} />} />
          <Route path="/corpus" element={<CorpusPage coder={coder} />} />
          <Route path="/coding/:documentId" element={<CodingPage coder={coder} />} />
          <Route path="/codebook" element={<CodebookPage coder={coder} />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/exports" element={<ExportsPage />} />
        </Routes>
      </main>
    </div>
  );
}
