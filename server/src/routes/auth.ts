import { Router } from "express";
import {
  authEnabled,
  checkPassphrase,
  clearedCookie,
  issueToken,
  rateLimitLogin,
  resetLoginAttempts,
  resolveIdentity,
  sessionCookie,
} from "../lib/auth.js";
import { accessEnabled } from "../lib/accessJwt.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const authRouter = Router();

authRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const identity = await resolveIdentity(req);
    res.json({
      authEnabled,
      accessEnabled,
      authenticated: identity !== null,
      method: identity?.method ?? null,
      email: identity?.email ?? null,
    });
  }),
);

authRouter.post(
  "/login",
  rateLimitLogin,
  asyncHandler(async (req, res) => {
    // Derrière Access, la personne est déjà authentifiée : pas de second mot de passe.
    const existing = await resolveIdentity(req);
    if (existing?.method === "access" || existing?.method === "open") {
      res.json({ authEnabled, accessEnabled, authenticated: true, method: existing.method, email: existing.email });
      return;
    }

    if (!checkPassphrase(req.body?.passphrase)) {
      res.status(401).json({ error: "Phrase de passe invalide" });
      return;
    }
    resetLoginAttempts(req);
    res.set("Set-Cookie", sessionCookie(issueToken()));
    res.json({ authEnabled, accessEnabled, authenticated: true, method: "passphrase", email: null });
  }),
);

authRouter.post("/logout", (_req, res) => {
  res.set("Set-Cookie", clearedCookie());
  res.json({ authEnabled, accessEnabled, authenticated: false, method: null, email: null });
});
