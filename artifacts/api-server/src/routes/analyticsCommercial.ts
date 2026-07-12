import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, prospectsTable, devisTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const analyticsCommercialRouter = Router();
analyticsCommercialRouter.use(requireModuleAccess("analyticsCommercial"));

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function joursEntre(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

// Indicateurs agreges (pas de champ "commercial assigne" en base actuellement
// — vue globale par licence, pas de repartition par utilisateur).
analyticsCommercialRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const prospects = await db.select().from(prospectsTable).where(eq(prospectsTable.licenceId, licenceId));
  const devis = await db.select().from(devisTable).where(eq(devisTable.licenceId, licenceId));

  const prospectsActifs = prospects.filter((p) => p.active && !p.anonymise);
  const parStatutProspects: Record<string, number> = {};
  for (const p of prospectsActifs) parStatutProspects[p.statut] = (parStatutProspects[p.statut] ?? 0) + 1;
  const gagnes = prospectsActifs.filter((p) => p.statut === "GAGNE");
  const perdus = prospectsActifs.filter((p) => p.statut === "PERDU");
  const clotures = [...gagnes, ...perdus];
  const scoreMoyen = prospectsActifs.length > 0 ? round1(prospectsActifs.reduce((s, p) => s + p.score, 0) / prospectsActifs.length) : 0;
  const dureeMoyenneCycleJours = clotures.length > 0
    ? round1(clotures.reduce((s, p) => s + joursEntre(p.createdAt, p.updatedAt), 0) / clotures.length)
    : null;

  const devisActifs = devis.filter((d) => d.active);
  const parStatutDevis: Record<string, number> = {};
  for (const d of devisActifs) parStatutDevis[d.statut] = (parStatutDevis[d.statut] ?? 0) + 1;
  const acceptes = devisActifs.filter((d) => d.statut === "ACCEPTE");
  const refuses = devisActifs.filter((d) => d.statut === "REFUSE");
  const decides = [...acceptes, ...refuses];
  const montantMoyenHt = devisActifs.length > 0 ? round1(devisActifs.reduce((s, d) => s + Number(d.montantHt), 0) / devisActifs.length) : 0;
  const avecDelai = devisActifs.filter((d) => d.dateEnvoi && d.dateReponse);
  const delaiMoyenReponseJours = avecDelai.length > 0
    ? round1(avecDelai.reduce((s, d) => s + joursEntre(d.dateEnvoi!, d.dateReponse!), 0) / avecDelai.length)
    : null;

  res.json({
    prospects: {
      total: prospectsActifs.length,
      parStatut: parStatutProspects,
      tauxConversionPercent: clotures.length > 0 ? round1((gagnes.length / clotures.length) * 100) : null,
      scoreMoyen,
      dureeMoyenneCycleJours,
    },
    devis: {
      total: devisActifs.length,
      parStatut: parStatutDevis,
      tauxTransformationPercent: decides.length > 0 ? round1((acceptes.length / decides.length) * 100) : null,
      montantMoyenHt,
      delaiMoyenReponseJours,
    },
  });
});
