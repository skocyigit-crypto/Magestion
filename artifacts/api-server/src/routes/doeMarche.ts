import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, doeMarcheTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const doeMarcheRouter = Router();
doeMarcheRouter.use(requireModuleAccess("doeMarche"));

doeMarcheRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const marcheId = req.query.marcheId;
  if (typeof marcheId !== "string") {
    res.status(400).json({ error: "marcheId requis en query" });
    return;
  }

  const rows = await db.select().from(doeMarcheTable).where(and(eq(doeMarcheTable.licenceId, licenceId), eq(doeMarcheTable.marcheId, marcheId)));
  res.json(rows.sort((a, b) => a.version - b.version));
});

const doeInputSchema = z.object({
  marcheId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  sectionsSnapshot: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        sourceTable: z.string().optional(),
        sourceId: z.string().optional(),
        skipped: z.boolean().optional(),
        skipReason: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

// Chaque appel cree une NOUVELLE version finalisee (pas de brouillon persiste,
// pas de mise a jour d'une version existante — voir commentaire schema). La
// version precedente est marquee SUPERSEDED, jamais supprimee (regle produit).
doeMarcheRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = doeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const existing = await db.select().from(doeMarcheTable).where(eq(doeMarcheTable.marcheId, parsed.data.marcheId));
  const nextVersion = existing.reduce((max, d) => Math.max(max, d.version), 0) + 1;

  const previousFinalise = existing.find((d) => d.statut === "FINALISE");
  if (previousFinalise) {
    await db.update(doeMarcheTable).set({ statut: "SUPERSEDED" }).where(eq(doeMarcheTable.id, previousFinalise.id));
  }

  const [created] = await db
    .insert(doeMarcheTable)
    .values({ licenceId, ...parsed.data, version: nextVersion })
    .returning();
  res.status(201).json(created);
});
