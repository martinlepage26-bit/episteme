import { Router } from "express";
import {
  authEnabled,
  checkPassphrase,
  clearedCookie,
  isAuthenticated,
  issueToken,
  rateLimitLogin,
  resetLoginAttempts,
  sessionCookie,
} from "../lib/auth.js";

export const authRouter = Router();

authRouter.get("/status", (req, res) => {
  res.json({ authEnabled, authenticated: isAuthenticated(req) });
});

authRouter.post("/login", rateLimitLogin, (req, res) => {
  if (!authEnabled) {
    res.json({ authEnabled: false, authenticated: true });
    return;
  }
  if (!checkPassphrase(req.body?.passphrase)) {
    res.status(401).json({ error: "Phrase de passe invalide" });
    return;
  }
  resetLoginAttempts(req);
  res.set("Set-Cookie", sessionCookie(issueToken()));
  res.json({ authEnabled: true, authenticated: true });
});

authRouter.post("/logout", (_req, res) => {
  res.set("Set-Cookie", clearedCookie());
  res.json({ authEnabled, authenticated: false });
});
