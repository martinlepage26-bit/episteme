import { Router } from "express";
import { collections } from "../db.js";
import { serialize } from "../lib/serialize.js";
import { buildCodebookMarkdown, buildQuotationBookMarkdown } from "../lib/markdown.js";

export const exportsRouter = Router();

exportsRouter.get("/codebook.md", async (_req, res) => {
  const codes = await collections.codes.find().sort({ createdAt: 1 }).toArray();
  const markdown = buildCodebookMarkdown(codes.map(serialize));
  res.set("Content-Type", "text/markdown; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="codebook.md"');
  res.send(markdown);
});

exportsRouter.get("/quotation-book.md", async (_req, res) => {
  const [citations, documents, codingEvents, codes] = await Promise.all([
    collections.citations.find().sort({ createdAt: 1 }).toArray(),
    collections.documents.find().toArray(),
    collections.codingEvents.find().toArray(),
    collections.codes.find().toArray(),
  ]);
  const markdown = buildQuotationBookMarkdown(
    citations.map(serialize),
    documents.map(serialize),
    codingEvents.map(serialize),
    codes.map(serialize),
  );
  res.set("Content-Type", "text/markdown; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="recueil-de-citations.md"');
  res.send(markdown);
});
