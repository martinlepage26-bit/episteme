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
  if (status && (!status.authEnabled || status.authenticated)) {
    return <>{children}</>;
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
