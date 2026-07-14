import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, bonsLivraisonTable, commandesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const bonsLivraisonRouter = Router();
bonsLivraisonRouter.use(requireModuleAccess("commandes"));

function withMontantLivreHt(row: typeof bonsLivraisonTable.$inferSelect) {
  return { ...row, montantLivreHt: Number(row.commandeMontantHt) * (Number(row.pourcentageLivre) / 100) };
}

// GET /?commandeId=xxx (requis) — liste ordonnee par numero, la plus recente
// donne le pourcentage cumule courant.
bonsLivraisonRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const commandeId = req.query.commandeId;
  if (typeof commandeId !== "string") {
    res.status(400).json({ error: "commandeId requis en query" });
    return;
  }

  const rows = await db
    .select()
    .from(bonsLivraisonTable)
    .where(and(eq(bonsLivraisonTable.licenceId, licenceId), eq(bonsLivraisonTable.commandeId, commandeId), eq(bonsLivraisonTable.active, true)))
    .orderBy(bonsLivraisonTable.numeroBl);

  res.json(rows.map(withMontantLivreHt));
});

const blInputSchema = z.object({
  commandeId: z.string().uuid(),
  pourcentageLivre: z.number().min(0).max(100),
  dateLivraison: z.string().optional(),
  conformite: z.enum(["CONFORME", "NON_CONFORME", "PARTIELLE"]).optional(),
  notes: z.string().optional(),
});

bonsLivraisonRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = blInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [commande] = await db
    .select()
    .from(commandesTable)
    .where(and(eq(commandesTable.id, parsed.data.commandeId), eq(commandesTable.licenceId, licenceId)))
    .limit(1);
  if (!commande) {
    res.status(404).json({ error: "Commande introuvable" });
    return;
  }

  const existing = await db
    .select()
    .from(bonsLivraisonTable)
    .where(and(eq(bonsLivraisonTable.commandeId, commande.id), eq(bonsLivraisonTable.licenceId, licenceId), eq(bonsLivraisonTable.active, true)))
    .orderBy(desc(bonsLivraisonTable.numeroBl));

  const last = existing[0] ?? null;
  if (last && parsed.data.pourcentageLivre < Number(last.pourcentageLivre)) {
    res.status(409).json({
      error: `Pourcentage livre (${parsed.data.pourcentageLivre}%) inferieur au bon precedent (${last.pourcentageLivre}%) — non autorise`,
    });
    return;
  }

  const { commandeId, dateLivraison, ...rest } = parsed.data;
  const [created] = await db
    .insert(bonsLivraisonTable)
    .values({
      licenceId,
      commandeId,
      numeroBl: (last?.numeroBl ?? 0) + 1,
      commandeMontantHt: commande.montantHt,
      ...rest,
      pourcentageLivre: parsed.data.pourcentageLivre.toString(),
      dateLivraison: dateLivraison,
    })
    .returning();

  res.status(201).json(withMontantLivreHt(created));
});

const blUpdateSchema = blInputSchema.omit({ commandeId: true }).partial();

// Correction possible uniquement tant que le bon est en BROUILLON (regle
// produit, comme situations/factures).
bonsLivraisonRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = blUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(bonsLivraisonTable)
    .where(and(eq(bonsLivraisonTable.id, req.params.id), eq(bonsLivraisonTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Bon de livraison introuvable" });
    return;
  }
  if (existing.statut !== "BROUILLON") {
    res.status(423).json({ error: "Bon de livraison verrouille (deja valide)" });
    return;
  }

  const { pourcentageLivre, ...rest } = parsed.data;
  const [updated] = await db
    .update(bonsLivraisonTable)
    .set({
      ...rest,
      ...(pourcentageLivre !== undefined ? { pourcentageLivre: pourcentageLivre.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(bonsLivraisonTable.id, existing.id))
    .returning();
  res.json(withMontantLivreHt(updated));
});

// Validation = verrouillage definitif. Si le cumul atteint 100%, la commande
// passe automatiquement au statut LIVREE (effet de bord assume, comme
// l'imputation d'un avenant met a jour montant_actuel_ht d'un marche public).
bonsLivraisonRouter.post("/:id/valider", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [bl] = await db
    .select()
    .from(bonsLivraisonTable)
    .where(and(eq(bonsLivraisonTable.id, req.params.id), eq(bonsLivraisonTable.licenceId, licenceId)))
    .limit(1);
  if (!bl) {
    res.status(404).json({ error: "Bon de livraison introuvable" });
    return;
  }
  if (bl.statut !== "BROUILLON") {
    res.status(409).json({ error: "Bon de livraison deja valide" });
    return;
  }

  const [updated] = await db
    .update(bonsLivraisonTable)
    .set({ statut: "VALIDE", updatedAt: new Date() })
    .where(eq(bonsLivraisonTable.id, bl.id))
    .returning();

  if (Number(bl.pourcentageLivre) >= 100) {
    await db
      .update(commandesTable)
      .set({ statut: "LIVREE", updatedAt: new Date() })
      .where(and(eq(commandesTable.id, bl.commandeId), eq(commandesTable.licenceId, licenceId)));
  }

  res.json(withMontantLivreHt(updated));
});
