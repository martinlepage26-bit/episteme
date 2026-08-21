import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui";
import { api } from "../lib/api";

function DownloadLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85"
    >
      {children}
    </a>
  );
}

export default function ExportsPage({ coder }: { coder: string }) {
  const chainQuery = useQuery({ queryKey: ["chain"], queryFn: api.audit.verify });
  const chain = chainQuery.data;

  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl">Exportations</h1>
      <p className="mb-6 max-w-3xl text-sm text-ink/50">
        Artefacts de recherche formels. Le codebook et le recueil documentent l'analyse ; l'export
        d'audit en atteste le cheminement.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-serif text-lg">Codebook</h2>
          <p className="mb-3 text-sm text-ink/60">
            ID, nom, définition, critères d'inclusion/exclusion, exemple, hiérarchie, historique.
          </p>
          <DownloadLink href="/api/exports/codebook.md">Télécharger codebook.md</DownloadLink>
        </Card>

        <Card>
          <h2 className="mb-1 font-serif text-lg">Recueil de citations</h2>
          <p className="mb-3 text-sm text-ink/60">
            Chaque extrait codé, séparé par posture, avec mémo d'interprétation, provenance et
            réconciliation le cas échéant.
          </p>
          <DownloadLink href="/api/exports/quotation-book.md">
            Télécharger recueil-de-citations.md
          </DownloadLink>
        </Card>

        <Card className="sm:col-span-2">
          <h2 className="mb-1 font-serif text-lg">Audit immuable (JSON)</h2>
          <p className="mb-3 max-w-2xl text-sm text-ink/60">
            La séquence complète des événements avec rang, empreinte et empreinte précédente,
            précédée d'un <code className="font-mono text-xs">export_id</code> et du triplet de
            session. Le corps est scellé par sa propre empreinte : un fichier modifié ne correspond
            plus à son <code className="font-mono text-xs">bodyHash</code>. Ce n'est pas une copie de
            la base — les documents n'y figurent que par leurs métadonnées et l'empreinte de leur
            contenu.
          </p>
          {chain && (
            <p className="mb-3 text-xs text-ink/50">
              État de la chaîne au moment de l'export :{" "}
              {chain.status === "verified" ? (
                <span className="text-ink/70">vérifiée · {chain.eventCount} événement(s)</span>
              ) : chain.status === "broken" ? (
                <span className="text-red-800">rompue au rang {chain.firstBrokenSeq}</span>
              ) : (
                <span>vide</span>
              )}
            </p>
          )}
          <DownloadLink
            href={`/api/exports/audit.json?exportedBy=${encodeURIComponent(coder || "—")}`}
          >
            Télécharger audit.json
          </DownloadLink>
        </Card>
      </div>

      <p className="mt-6 text-xs text-ink/40">
        Export .docx (codebook, recueil de citations) : non implémenté.
      </p>
    </div>
  );
}
