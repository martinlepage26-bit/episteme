import { Card } from "../components/ui";

export default function ExportsPage() {
  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl">Exportations</h1>
      <p className="mb-6 text-sm text-ink/50">
        Artefacts de recherche en Markdown. Le codebook liste les codes et leur définition ; le
        recueil de citations liste chaque extrait codé avec sa provenance.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-serif text-lg">Codebook</h2>
          <p className="mb-3 text-sm text-ink/60">
            ID, nom, définition, critères d'inclusion/exclusion, exemple, hiérarchie, historique.
          </p>
          <a
            href="/api/exports/codebook.md"
            download
            className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85"
          >
            Télécharger codebook.md
          </a>
        </Card>

        <Card>
          <h2 className="mb-1 font-serif text-lg">Recueil de citations</h2>
          <p className="mb-3 text-sm text-ink/60">
            Référence du document, position, texte exact, code(s) appliqué(s), codeur, mémo.
          </p>
          <a
            href="/api/exports/quotation-book.md"
            download
            className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85"
          >
            Télécharger recueil-de-citations.md
          </a>
        </Card>
      </div>

      <p className="mt-6 text-xs text-ink/40">
        Export JSON immuable (avec export_id et empreinte de session) et export .docx : phase 2.
      </p>
    </div>
  );
}
