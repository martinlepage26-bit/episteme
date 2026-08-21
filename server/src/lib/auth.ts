import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE_NAME = "episteme_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

const passphrase = process.env.EPISTEME_PASSPHRASE ?? "";
const secret = process.env.EPISTEME_SESSION_SECRET ?? "";

/**
 * L'authentification est active seulement si les deux variables sont fournies.
 * En développement local (sans .env d'authentification), l'outil reste ouvert.
 * En production, l'absence de configuration est une erreur fatale : voir index.ts.
 */
export const authEnabled = passphrase.length > 0 && secret.length > 0;

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // `timingSafeEqual` exige des longueurs égales ; on compare d'abord des
  // empreintes de longueur fixe pour ne pas divulguer la longueur attendue.
  const hashA = crypto.createHash("sha256").update(bufA).digest();
  const hashB = crypto.createHash("sha256").update(bufB).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!timingSafeEqual(signature, sign(payload))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function checkPassphrase(candidate: unknown): boolean {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  return timingSafeEqual(candidate, passphrase);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearedCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function isAuthenticated(req: Request): boolean {
  if (!authEnabled) return true;
  return verifyToken(parseCookies(req.headers.cookie)[COOKIE_NAME]);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "Authentification requise" });
}

/**
 * Limitation de débit en mémoire sur les tentatives de connexion.
 * Suffisant pour un processus unique ; à remplacer si l'API est répliquée.
 */
const attempts = new Map<string, { count: number; windowStart: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000; // 10 min

export function rateLimitLogin(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    next();
    return;
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
    return;
  }
  next();
}

export function resetLoginAttempts(req: Request) {
  attempts.delete(req.ip ?? "unknown");
}
