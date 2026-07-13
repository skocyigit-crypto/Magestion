import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, avoirsTable, avoirLignesTable, facturesTable, licencesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { withNumero } from "../lib/numbering.js";
import { recordAvoirEmission } from "../lib/journalEntry.js";
import { licenceToPdfInfo, streamDocumentPdf, type DocumentPdfLigne } from "../lib/pdf.js";
import { ligneInputSchema, ligneMontantHt, totalLignesHt, type LigneInput } from "../lib/lignes.js";

export const avoirsRouter = Router();
avoirsRouter.use(requireModuleAccess("factures"));

async function toPdfLignes(avoirId: string): Promise<DocumentPdfLigne[] | undefined> {
  const rows = await db.select().from(avoirLignesTable).where(eq(avoirLignesTable.avoirId, avoirId));
  if (rows.length === 0) return undefined;
  return rows
    .sort((a, b) => a.ordre - b.ordre)
    .map((r) => {
      const l: LigneInput = { designation: r.designation, quantite: Number(r.quantite), unite: r.unite, prixUnitaireHt: Number(r.prixUnitaireHt), remisePercent: Number(r.remisePercent) };
      return { designation: l.designation, quantite: l.quantite, unite: r.unite, prixUnitaireHt: l.prixUnitaireHt, remisePercent: Number(r.remisePercent), montantHt: ligneMontantHt(l) };
    });
}

avoirsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(avoirsTable)
    .where(and(eq(avoirsTable.licenceId, licenceId), eq(avoirsTable.active, !onlyInactive)));
  res.json(rows);
});

const avoirInputSchema = z.object({
  factureId: z.string().uuid(),
  motif: z.string().min(1).max(500),
  lignes: z.array(ligneInputSchema).min(1).max(200),
});

// Un avoir se cree TOUJOURS contre une facture deja EMISE (jamais un
// brouillon) : corriger un brouillon se fait en le modifiant directement,
// l'avoir est reserve a l'annulation/correction d'un fait comptable deja constate.
avoirsRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = avoirInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [facture] = await db
    .select()
    .from(facturesTable)
    .where(and(eq(facturesTable.id, parsed.data.factureId), eq(facturesTable.licenceId, licenceId)))
    .limit(1);
  if (!facture) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }
  if (facture.statut === "BROUILLON") {
    res.status(409).json({ error: "Impossible de creer un avoir sur une facture brouillon — modifiez-la directement" });
    return;
  }

  const montantHt = totalLignesHt(parsed.data.lignes);

  const created = await withNumero("avoirs", "AV", licenceId, async (numero) => {
    const [row] = await db
      .insert(avoirsTable)
      .values({
        licenceId,
        factureId: facture.id,
        numero,
        motif: parsed.data.motif,
        montantHt: montantHt.toString(),
        tauxTva: facture.tauxTva,
      })
      .returning();
    await db.insert(avoirLignesTable).values(
      parsed.data.lignes.map((l, i) => ({
        avoirId: row.id,
        ordre: i,
        designation: l.designation,
        quantite: l.quantite.toString(),
        unite: l.unite ?? "u",
        prixUnitaireHt: l.prixUnitaireHt.toString(),
        remisePercent: (l.remisePercent ?? 0).toString(),
      })),
    );
    return row;
  });

  res.status(201).json(created);
});

avoirsRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [avoir] = await db
    .select()
    .from(avoirsTable)
    .where(and(eq(avoirsTable.id, req.params.id), eq(avoirsTable.licenceId, licenceId)))
    .limit(1);
  if (!avoir) {
    res.status(404).json({ error: "Avoir introuvable" });
    return;
  }
  res.json(avoir);
});

avoirsRouter.get("/:id/lignes", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [avoir] = await db
    .select()
    .from(avoirsTable)
    .where(and(eq(avoirsTable.id, req.params.id), eq(avoirsTable.licenceId, licenceId)))
    .limit(1);
  if (!avoir) {
    res.status(404).json({ error: "Avoir introuvable" });
    return;
  }

  const lignes = await db.select().from(avoirLignesTable).where(eq(avoirLignesTable.avoirId, avoir.id));
  res.json(lignes.sort((a, b) => a.ordre - b.ordre));
});

avoirsRouter.put("/:id/lignes", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ lignes: z.array(ligneInputSchema).min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [avoir] = await db
    .select()
    .from(avoirsTable)
    .where(and(eq(avoirsTable.id, req.params.id), eq(avoirsTable.licenceId, licenceId)))
    .limit(1);
  if (!avoir) {
    res.status(404).json({ error: "Avoir introuvable" });
    return;
  }
  if (avoir.statut !== "BROUILLON") {
    res.status(423).json({ error: "Avoir verrouille (deja emis) — les lignes ne sont plus modifiables" });
    return;
  }

  await db.delete(avoirLignesTable).where(eq(avoirLignesTable.avoirId, avoir.id));
  const inserted = await db
    .insert(avoirLignesTable)
    .values(parsed.data.lignes.map((l, i) => ({
      avoirId: avoir.id,
      ordre: i,
      designation: l.designation,
      quantite: l.quantite.toString(),
      unite: l.unite ?? "u",
      prixUnitaireHt: l.prixUnitaireHt.toString(),
      remisePercent: (l.remisePercent ?? 0).toString(),
    })))
    .returning();

  const montantHt = totalLignesHt(parsed.data.lignes);
  const [updatedAvoir] = await db
    .update(avoirsTable)
    .set({ montantHt: montantHt.toString(), updatedAt: new Date() })
    .where(eq(avoirsTable.id, avoir.id))
    .returning();

  res.json({ avoir: updatedAvoir, lignes: inserted.sort((a, b) => a.ordre - b.ordre) });
});

avoirsRouter.get("/:id/pdf", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [avoir] = await db
    .select()
    .from(avoirsTable)
    .where(and(eq(avoirsTable.id, req.params.id), eq(avoirsTable.licenceId, licenceId)))
    .limit(1);
  if (!avoir) {
    res.status(404).json({ error: "Avoir introuvable" });
    return;
  }
  const [facture] = await db.select().from(facturesTable).where(eq(facturesTable.id, avoir.factureId)).limit(1);
  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);

  streamDocumentPdf(res, {
    type: "AVOIR",
    numero: avoir.numero,
    dateEmission: avoir.createdAt,
    client: facture?.client ?? "",
    objet: `${avoir.motif} (suite a la facture ${facture?.numero ?? "?"})`,
    montantHt: Number(avoir.montantHt),
    tauxTva: Number(avoir.tauxTva),
    licence: await licenceToPdfInfo(licence),
    lignes: await toPdfLignes(avoir.id),
  });
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
avoirsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ motif: z.string().min(1).max(500).optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [existing] = await db
    .select()
    .from(avoirsTable)
    .where(and(eq(avoirsTable.id, req.params.id), eq(avoirsTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Avoir introuvable" });
    return;
  }
  if (parsed.data.motif !== undefined && existing.statut !== "BROUILLON") {
    res.status(423).json({ error: "Avoir verrouille (deja emis)" });
    return;
  }

  const [updated] = await db
    .update(avoirsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(avoirsTable.id, req.params.id), eq(avoirsTable.licenceId, licenceId)))
    .returning();
  res.json(updated);
});

// Emission definitive : verrouille le contenu et genere l'ecriture comptable
// inverse de la facture d'origine. Aucune transition retour (comme les
// factures) — une erreur d'avoir se corrige par un nouvel avoir, pas une modification.
avoirsRouter.post("/:id/emettre", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [avoir] = await db
    .select()
    .from(avoirsTable)
    .where(and(eq(avoirsTable.id, req.params.id), eq(avoirsTable.licenceId, licenceId)))
    .limit(1);
  if (!avoir) {
    res.status(404).json({ error: "Avoir introuvable" });
    return;
  }
  if (avoir.statut !== "BROUILLON") {
    res.status(409).json({ error: "Avoir deja emis" });
    return;
  }

  const [facture] = await db.select().from(facturesTable).where(eq(facturesTable.id, avoir.factureId)).limit(1);

  const now = new Date();
  const [updated] = await db
    .update(avoirsTable)
    .set({ statut: "EMIS", dateEmission: now, updatedAt: now })
    .where(and(eq(avoirsTable.id, req.params.id), eq(avoirsTable.licenceId, licenceId)))
    .returning();

  await recordAvoirEmission({
    licenceId,
    avoirId: updated.id,
    numero: updated.numero,
    client: facture?.client ?? "",
    montantHt: Number(updated.montantHt),
    tauxTva: Number(updated.tauxTva),
  });

  res.json(updated);
});
