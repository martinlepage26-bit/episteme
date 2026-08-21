import crypto from "node:crypto";

/**
 * Vérification du jeton Cloudflare Access.
 *
 * Quand Access est en amont, il joint à chaque requête un JWT signé
 * (`Cf-Access-Jwt-Assertion`) attestant *qui* est la personne. Le vérifier à
 * l'origine évite une seconde authentification par phrase de passe, et donne
 * mieux : une identité par personne, signée, plutôt qu'un secret partagé.
 *
 * L'en-tête n'est jamais cru sur parole — signature, `aud`, `iss` et `exp`
 * sont contrôlés. Sans cela, n'importe qui atteignant l'origine pourrait
 * forger l'en-tête et se déclarer authentifié.
 */
const teamDomain = (process.env.EPISTEME_ACCESS_TEAM_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const audience = process.env.EPISTEME_ACCESS_AUD ?? "";

export const accessEnabled = teamDomain.length > 0 && audience.length > 0;

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  [key: string]: unknown;
}

let cachedKeys: Jwk[] = [];
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 h

async function getKeys(forceRefresh = false): Promise<Jwk[]> {
  const stale = Date.now() - cachedAt > CACHE_TTL_MS;
  if (!forceRefresh && cachedKeys.length > 0 && !stale) return cachedKeys;

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`JWKS indisponible (HTTP ${response.status})`);
  const body = (await response.json()) as { keys?: Jwk[] };
  cachedKeys = body.keys ?? [];
  cachedAt = Date.now();
  return cachedKeys;
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

export interface AccessIdentity {
  email: string;
  subject: string;
  expiresAt: number;
}

export async function verifyAccessJwt(token: string | undefined): Promise<AccessIdentity | null> {
  if (!accessEnabled || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeSegment(headerPart);
    payload = decodeSegment(payloadPart);
  } catch {
    return null;
  }

  if (header.alg !== "RS256") return null;

  // Une rotation de clés invalide le cache : on retente une fois avec un JWKS frais.
  let keys = await getKeys();
  let jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    keys = await getKeys(true);
    jwk = keys.find((key) => key.kid === header.kid);
  }
  if (!jwk) return null;

  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });
  } catch {
    return null;
  }

  const signed = Buffer.from(`${headerPart}.${payloadPart}`, "utf8");
  const signature = Buffer.from(signaturePart, "base64url");
  if (!crypto.verify("RSA-SHA256", signed, publicKey, signature)) return null;

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;

  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp * 1000 <= Date.now()) return null;

  const email = typeof payload.email === "string" ? payload.email : "";
  if (!email) return null;

  return { email, subject: typeof payload.sub === "string" ? payload.sub : "", expiresAt: exp };
}

/** Le JWT arrive par en-tête ; le cookie CF_Authorization sert de repli. */
export function readAccessToken(headers: Record<string, unknown>, cookies: Record<string, string>) {
  const header = headers["cf-access-jwt-assertion"];
  if (typeof header === "string" && header) return header;
  return cookies.CF_Authorization || undefined;
}
