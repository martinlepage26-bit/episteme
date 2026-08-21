import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { api, onUnauthorized } from "../lib/api";
import { Button, Input, Label } from "./ui";

/**
 * Porte d'entrée. Tant que la session n'est pas établie, aucune donnée n'est
 * demandée à l'API — l'application n'est pas montée du tout.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["auth-status"],
    queryFn: api.auth.status,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    onUnauthorized(() => {
      queryClient.setQueryData(["auth-status"], { authEnabled: true, authenticated: false });
    });
    return () => onUnauthorized(null);
  }, [queryClient]);

  if (statusQuery.isLoading) {
    return <p className="p-8 text-sm text-ink/50">Chargement…</p>;
  }

  const status = statusQuery.data;
  if (status?.authenticated) {
    return <>{children}</>;
  }

  // Derrière Access sans session valide, redemander une phrase de passe serait
  // un cul-de-sac : c'est Cloudflare qui doit réémettre l'identité.
  if (status?.accessEnabled && !status.authEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 font-serif text-3xl italic tracking-tight">Épistémè</h1>
          <p className="mb-4 text-sm text-ink/50">Session Cloudflare Access expirée.</p>
          <Button className="w-full justify-center" onClick={() => window.location.reload()}>
            Se reconnecter
          </Button>
        </div>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.auth.login(passphrase);
      setPassphrase("");
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Échec de la connexion");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="mb-1 font-serif text-3xl italic tracking-tight">Épistémè</h1>
        <p className="mb-6 text-sm text-ink/50">
          Outil de codage qualitatif auditable. Accès restreint.
        </p>

        {status?.accessEnabled && (
          <p className="mb-4 rounded-sm border border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">
            Cette requête n'est pas passée par Cloudflare Access — accès direct à l'origine ou
            session expirée. Par <span className="font-mono">episteme.pharos-ai.ca</span>, Access
            authentifie et cet écran ne s'affiche pas.
          </p>
        )}

        <Label htmlFor="passphrase">Phrase de passe</Label>
        <Input
          id="passphrase"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
        />

        {error && <p className="mt-2 text-sm text-red-800">{error}</p>}

        <Button type="submit" className="mt-4 w-full justify-center" disabled={!passphrase || submitting}>
          {submitting ? "Vérification…" : "Entrer"}
        </Button>
      </form>
    </div>
  );
}
