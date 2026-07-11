import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, devisTable, facturesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { nextNumero } from "../lib/numbering.js";

export const devisRouter = Router();

const devisInputSchema = z.object({
  client: z.string().min(1).max(200),
  objet: z.string().min(1).max(500),
  projectId: z.string().uuid().optional(),
  montantHt: z.number().nonnegative(),
  tauxTva: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
});

const devisUpdateSchema = devisInputSchema.partial().extend({
  active: z.boolean().optional(),
});

devisRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.licenceId, licenceId), eq(devisTable.active, !onlyInactive)));

  res.json(rows);
});

devisRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = devisInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const numero = await nextNumero("devis", "DEV", licenceId);

  const [created] = await db
    .insert(devisTable)
    .values({
      licenceId,
      numero,
      client: parsed.data.client,
      objet: parsed.data.objet,
      projectId: parsed.data.projectId,
      montantHt: parsed.data.montantHt.toString(),
      tauxTva: parsed.data.tauxTva.toString(),
    })
    .returning();

  res.status(201).json(created);
});

devisRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [devis] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .limit(1);

  if (!devis) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }
  res.json(devis);
});

// Regle produit : un devis n'est JAMAIS supprime (403 pour tous les roles).
// Pas de DELETE ici ; PATCH { active: false } = archivage reversible.
devisRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = devisUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantHt, tauxTva, ...rest } = parsed.data;
  const [updated] = await db
    .update(devisTable)
    .set({
      ...rest,
      ...(montantHt !== undefined ? { montantHt: montantHt.toString() } : {}),
      ...(tauxTva !== undefined ? { tauxTva: tauxTva.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }
  res.json(updated);
});

// Flux impose : Brouillon -> Envoye -> Accepte / Refuse.
const TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ["ENVOYE"],
  ENVOYE: ["ACCEPTE", "REFUSE"],
  ACCEPTE: [],
  REFUSE: [],
};

devisRouter.post("/:id/statut", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: z.enum(["ENVOYE", "ACCEPTE", "REFUSE"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [devis] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .limit(1);
  if (!devis) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }

  if (!TRANSITIONS[devis.statut]?.includes(parsed.data.statut)) {
    res.status(409).json({ error: `Transition ${devis.statut} -> ${parsed.data.statut} non autorisee` });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(devisTable)
    .set({
      statut: parsed.data.statut,
      ...(parsed.data.statut === "ENVOYE" ? { dateEnvoi: now } : {}),
      ...(parsed.data.statut === "ACCEPTE" || parsed.data.statut === "REFUSE" ? { dateReponse: now } : {}),
      updatedAt: now,
    })
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});

// Convertit un devis ACCEPTE en facture (Brouillon). Idempotent : si une
// facture existe deja pour ce devis, la retourne au lieu d'en recreer une.
devisRouter.post("/:id/convertir-facture", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [devis] = await db
    .select()
    .from(devisTable)
    .where(and(eq(devisTable.id, req.params.id), eq(devisTable.licenceId, licenceId)))
    .limit(1);
  if (!devis) {
    res.status(404).json({ error: "Devis introuvable" });
    return;
  }
  if (devis.statut !== "ACCEPTE") {
    res.status(409).json({ error: "Seul un devis ACCEPTE peut etre converti en facture" });
    return;
  }

  const [existing] = await db.select().from(facturesTable).where(eq(facturesTable.devisId, devis.id)).limit(1);
  if (existing) {
    res.json(existing);
    return;
  }

  const numero = await nextNumero("factures", "FAC", licenceId);
  const [facture] = await db
    .insert(facturesTable)
    .values({
      licenceId,
      projectId: devis.projectId,
      devisId: devis.id,
      numero,
      client: devis.client,
      objet: devis.objet,
      montantHt: devis.montantHt,
      tauxTva: devis.tauxTva,
    })
    .returning();

  res.status(201).json(facture);
});
