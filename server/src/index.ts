import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "./db.js";
import { auditRouter } from "./routes/audit.js";
import { citationsRouter } from "./routes/citations.js";
import { codesRouter } from "./routes/codes.js";
import { codingEventsRouter } from "./routes/codingEvents.js";
import { documentsRouter } from "./routes/documents.js";
import { exportsRouter } from "./routes/exports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/status", (_req, res) => {
  res.json({ status: "ok", product: "Épistémè", phase: 1 });
});

app.use("/api/documents", documentsRouter);
app.use("/api/citations", citationsRouter);
app.use("/api/codes", codesRouter);
app.use("/api/coding-events", codingEventsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/exports", exportsRouter);

app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne" });
});

const port = Number(process.env.PORT ?? 4000);

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Épistémè API sur http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Échec de connexion à MongoDB", error);
    process.exit(1);
  });
