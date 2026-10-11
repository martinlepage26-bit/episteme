import type { RequestHandler } from "express";
import { MONGO_PING_TIMEOUT_MS } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { withTimeout } from "../lib/withTimeout.js";

export interface StatusDependencies {
  /** Commande admin `ping`. Rejette, ou ne se résout jamais, si MongoDB est injoignable. */
  ping: (timeoutMs: number) => Promise<unknown>;
  authEnabled: boolean;
  accessEnabled: boolean;
  /** Délai de la sonde. Par défaut `MONGO_PING_TIMEOUT_MS` (2 s). */
  timeoutMs?: number;
  /** Journalise l'échec réel. Par défaut `console.error`, sans le renvoyer au client. */
  onError?: (error: unknown) => void;
}

/**
 * GET /api/status — sonde publique.
 *
 * Pinge MongoDB (`admin.ping`, délai court) avant de répondre. `200` et
 * `status: "ok"` si la base répond ; `503` et `status: "error"` si elle est
 * injoignable, renvoie une erreur, ou dépasse le délai — le corps nomme alors
 * la dépendance (`dependencies.mongodb`). Les champs historiques `product`,
 * `phase`, `authEnabled` et `accessEnabled` sont toujours présents. Le délai
 * est appliqué ici, en plus du `timeoutMS` passé au pilote, pour que la
 * réponse ne reste pas bloquée si le pilote attend encore la sélection de serveur.
 */
export function createStatusHandler(deps: StatusDependencies): RequestHandler {
  const timeoutMs = deps.timeoutMs ?? MONGO_PING_TIMEOUT_MS;
  const onError = deps.onError ?? ((error: unknown) => console.error("Sonde MongoDB en échec", error));

  return asyncHandler(async (_req, res) => {
    try {
      await withTimeout(
        Promise.resolve().then(() => deps.ping(timeoutMs)),
        timeoutMs,
      );
      res.status(200).json(statusBody(deps, null));
    } catch (error) {
      onError(error);
      res.status(503).json(statusBody(deps, mongoFailureReason(error)));
    }
  });
}

function statusBody(deps: StatusDependencies, mongoError: string | null) {
  const ok = mongoError === null;
  return {
    status: ok ? "ok" : "error",
    product: "Épistémè" as const,
    phase: 2 as const,
    authEnabled: deps.authEnabled,
    accessEnabled: deps.accessEnabled,
    dependencies: {
      mongodb: {
        status: ok ? "ok" : "error",
        error: mongoError,
      },
    },
  };
}

function mongoFailureReason(error: unknown): "mongodb timed out" | "mongodb unavailable" {
  if (!(error instanceof Error)) return "mongodb unavailable";
  if (error.name === "MongoOperationTimeoutError") return "mongodb timed out";
  if (/timed?\s*out/i.test(`${error.name} ${error.message}`)) return "mongodb timed out";
  return "mongodb unavailable";
}
