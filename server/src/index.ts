import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb, ensureIndexes } from "./db.js";
import { authEnabled, requireAuth } from "./lib/auth.js";
import { auditRouter } from "./routes/audit.js";
import { authRouter } from "./routes/auth.js";
import { citationsRouter } from "./routes/citations.js";
import { codesRouter } from "./routes/codes.js";
import { codingEventsRouter } from "./routes/codingEvents.js";
import { compareRouter } from "./routes/compare.js";
import { documentsRouter } from "./routes/documents.js";
import { exportsRouter } from "./routes/exports.js";
import { reconciliationsRouter } from "./routes/reconciliations.js";
import { sessionsRouter } from "./routes/sessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

const requireAuthConfigured = process.env.EPISTEME_REQUIRE_AUTH === "1";
if (requireAuthConfigured && !authEnabled) {
  console.error(
    "EPISTEME_REQUIRE_AUTH=1 mais EPISTEME_PASSPHRASE / EPISTEME_SESSION_SECRET sont absents. Arrêt.",
  );
  process.exit(1);
}

const app = express();

// L'origine n'est jointe que par cloudflared depuis la boucle locale : on lui
// fait confiance pour X-Forwarded-For, afin que la limitation de débit sur la
// connexion voie la vraie adresse cliente et non 127.0.0.1.
app.set("trust proxy", "loopback");
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));

app.get("/api/status", (_req, res) => {
  res.json({ status: "ok", product: "Épistémè", phase: 2, authEnabled });
});

// Non protégé : c'est la porte d'entrée.
app.use("/api/auth", authRouter);

// Tout le reste de l'API exige une session valide.
app.use("/api", requireAuth);
app.use("/api/documents", documentsRouter);
app.use("/api/citations", citationsRouter);
app.use("/api/codes", codesRouter);
app.use("/api/coding-events", codingEventsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/reconciliations", reconciliationsRouter);
app.use("/api/compare", compareRouter);
app.use("/api/audit", auditRouter);
app.use("/api/exports", exportsRouter);

app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Erreur interne" });
});

const port = Number(process.env.PORT ?? 4000);

connectDb()
  .then(ensureIndexes)
  .then(() => {
    app.listen(port, () => {
      console.log(
        `Épistémè API sur http://localhost:${port} — authentification ${authEnabled ? "activée" : "DÉSACTIVÉE"}`,
      );
    });
  })
  .catch((error) => {
    console.error(
      "Échec au démarrage (connexion MongoDB ou création des index). Si l'index unique sur auditEvents.seq échoue, lancez d'abord « npm run migrate ».",
      error,
    );
    process.exit(1);
  });
