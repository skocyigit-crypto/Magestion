import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, lotsMarcheTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const lotsMarcheRouter = Router();
lotsMarcheRouter.use(requireModuleAccess("marchesPublics"));

const lotInputSchema = z.object({
  marcheId: z.string().uuid(),
  numeroLot: z.string().min(1).max(50),
  intitule: z.string().min(1).max(500),
  corpsMetier: z.string().max(200).optional(),
  montantEstimeHt: z.number().nonnegative(),
  attributaireClientId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const lotUpdateSchema = lotInputSchema.partial().extend({
  montantAttribueHt: z.number().nonnegative().optional(),
});

lotsMarcheRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const marcheId = req.query.marcheId;
  if (typeof marcheId !== "string") {
    res.status(400).json({ error: "marcheId requis en query" });
    return;
  }

  const rows = await db
    .select()
    .from(lotsMarcheTable)
    .where(and(eq(lotsMarcheTable.licenceId, licenceId), eq(lotsMarcheTable.marcheId, marcheId)));
  res.json(rows);
});

lotsMarcheRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = lotInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantEstimeHt, ...rest } = parsed.data;
  const [created] = await db
    .insert(lotsMarcheTable)
    .values({ licenceId, ...rest, montantEstimeHt: montantEstimeHt.toString() })
    .returning();
  res.status(201).json(created);
});

lotsMarcheRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = lotUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantEstimeHt, montantAttribueHt, ...rest } = parsed.data;
  const [updated] = await db
    .update(lotsMarcheTable)
    .set({
      ...rest,
      ...(montantEstimeHt !== undefined ? { montantEstimeHt: montantEstimeHt.toString() } : {}),
      ...(montantAttribueHt !== undefined ? { montantAttribueHt: montantAttribueHt.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(lotsMarcheTable.id, req.params.id), eq(lotsMarcheTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Lot introuvable" });
    return;
  }
  res.json(updated);
});

const STATUT_TRANSITIONS: Record<string, string[]> = {
  A_ATTRIBUER: ["ATTRIBUE", "INFRUCTUEUX"],
  ATTRIBUE: ["TERMINE"],
  INFRUCTUEUX: [],
  TERMINE: [],
};

lotsMarcheRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z
    .object({ statut: z.enum(["ATTRIBUE", "INFRUCTUEUX", "TERMINE"]), attributaireClientId: z.string().uuid().optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [lot] = await db
    .select()
    .from(lotsMarcheTable)
    .where(and(eq(lotsMarcheTable.id, req.params.id), eq(lotsMarcheTable.licenceId, licenceId)))
    .limit(1);
  if (!lot) {
    res.status(404).json({ error: "Lot introuvable" });
    return;
  }
  if (!STATUT_TRANSITIONS[lot.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${lot.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(lotsMarcheTable)
    .set({
      statut: parsed.data.statut,
      ...(parsed.data.statut === "ATTRIBUE" ? { dateAttribution: now, attributaireClientId: parsed.data.attributaireClientId } : {}),
      updatedAt: now,
    })
    .where(eq(lotsMarcheTable.id, lot.id))
    .returning();
  res.json(updated);
});
