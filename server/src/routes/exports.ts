import { Router } from "express";
import { collections } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { serialize } from "../lib/serialize.js";
import { buildCodebookMarkdown, buildQuotationBookMarkdown } from "../lib/markdown.js";
import { buildAuditExport } from "../lib/exportJson.js";

export const exportsRouter = Router();

exportsRouter.get(
  "/codebook.md",
  asyncHandler(async (_req, res) => {
    const codes = await collections.codes.find().sort({ createdAt: 1 }).toArray();
    const markdown = buildCodebookMarkdown(codes.map(serialize));
    res.set("Content-Type", "text/markdown; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="codebook.md"');
    res.send(markdown);
  }),
);

exportsRouter.get(
  "/quotation-book.md",
  asyncHandler(async (_req, res) => {
    const [citations, documents, codingEvents, codes, reconciliations] = await Promise.all([
      collections.citations.find().sort({ createdAt: 1 }).toArray(),
      collections.documents.find().toArray(),
      collections.codingEvents.find().toArray(),
      collections.codes.find().toArray(),
      collections.reconciliations.find().toArray(),
    ]);
    const markdown = buildQuotationBookMarkdown(
      citations.map(serialize),
      documents.map(serialize),
      codingEvents.map(serialize),
      codes.map(serialize),
      reconciliations.map(serialize),
    );
    res.set("Content-Type", "text/markdown; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="recueil-de-citations.md"');
    res.send(markdown);
  }),
);

exportsRouter.get(
  "/audit.json",
  asyncHandler(async (req, res) => {
    const exportedBy = typeof req.query.exportedBy === "string" ? req.query.exportedBy : "—";
    const payload = await buildAuditExport(exportedBy);
    res.set("Content-Type", "application/json; charset=utf-8");
    res.set(
      "Content-Disposition",
      `attachment; filename="audit-${payload.export_id}.json"`,
    );
    res.send(JSON.stringify(payload, null, 2));
  }),
);
