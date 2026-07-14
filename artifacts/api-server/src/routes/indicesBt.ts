import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, indicesBtTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const indicesBtRouter = Router();
indicesBtRouter.use(requireModuleAccess("indicesBt"));

// Reference pure : append-only, pas de PATCH/DELETE. Chaque publication
// mensuelle d'un indice INSEE est une nouvelle ligne (voir schema/indicesBt.ts).
const indiceInputSchema = z.object({
  code: z.string().min(1).max(50),
  libelle: z.string().min(1).max(300),
  periode: z.string().min(1).max(20),
  valeur: z.number().positive(),
  datePublication: z.string().optional(),
  source: z.string().max(100).optional(),
  notes: z.string().optional(),
});

indicesBtRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const code = req.query.code;
  const conditions = [eq(indicesBtTable.licenceId, licenceId)];
  if (typeof code === "string") conditions.push(eq(indicesBtTable.code, code));

  const rows = await db
    .select()
    .from(indicesBtTable)
    .where(and(...conditions));
  res.json(rows);
});

indicesBtRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = indiceInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { valeur, ...rest } = parsed.data;
  const [created] = await db
    .insert(indicesBtTable)
    .values({ licenceId, ...rest, valeur: valeur.toString() })
    .returning();
  res.status(201).json(created);
});
