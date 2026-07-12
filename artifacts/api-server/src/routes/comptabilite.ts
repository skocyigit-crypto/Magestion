import { Router } from "express";
import { z } from "zod";
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db, journalEntriesTable, licencesTable, planComptableTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const comptabiliteRouter = Router();
comptabiliteRouter.use(requireModuleAccess("comptabilite"));

comptabiliteRouter.get("/plan-comptable", async (_req, res) => {
  const rows = await db.select().from(planComptableTable).where(eq(planComptableTable.active, true));
  res.json(rows);
});

// Grand livre : toutes les ecritures, triees par ecritureNum (ordre chronologique).
comptabiliteRouter.get("/journal", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.licenceId, licenceId))
    .orderBy(asc(journalEntriesTable.ecritureNum), asc(journalEntriesTable.id));

  res.json(rows);
});

// Balance de verification : somme debit/credit par compte, solde et sens.
// exercice=YYYY optionnel (filtre par annee d'ecriture), memes conventions que /fec.
comptabiliteRouter.get("/balance", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const exercice = req.query.exercice ? Number(req.query.exercice) : undefined;
  const conditions = [eq(journalEntriesTable.licenceId, licenceId)];
  if (exercice) {
    conditions.push(gte(journalEntriesTable.ecritureDate, `${exercice}-01-01`));
    conditions.push(lte(journalEntriesTable.ecritureDate, `${exercice}-12-31`));
  }

  const rows = await db
    .select({
      compteNum: journalEntriesTable.compteNum,
      compteLib: journalEntriesTable.compteLib,
      totalDebit: sql<string>`SUM(${journalEntriesTable.debit})`,
      totalCredit: sql<string>`SUM(${journalEntriesTable.credit})`,
    })
    .from(journalEntriesTable)
    .where(and(...conditions))
    .groupBy(journalEntriesTable.compteNum, journalEntriesTable.compteLib)
    .orderBy(asc(journalEntriesTable.compteNum));

  const balance = rows.map((r) => {
    const totalDebit = Number(r.totalDebit);
    const totalCredit = Number(r.totalCredit);
    const solde = totalDebit - totalCredit;
    return {
      compteNum: r.compteNum,
      compteLib: r.compteLib,
      totalDebit,
      totalCredit,
      solde: Math.abs(solde),
      sens: solde >= 0 ? "DEBITEUR" : "CREDITEUR",
    };
  });

  res.json(balance);
});

// Genere le prochain code de lettrage (A, B, ... Z, AA, AB...) — sequence
// alphabetique classique de la comptabilite francaise.
function codeFromIndex(n: number): string {
  let s = "";
  let num = n;
  do {
    s = String.fromCharCode(65 + (num % 26)) + s;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);
  return s;
}

// Ecritures non lettrees d'un compte — pour choisir lesquelles rapprocher
// (ex: une facture 411 debit et un reglement 411 credit qui se soldent).
comptabiliteRouter.get("/lettrage/:compteNum", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.licenceId, licenceId), eq(journalEntriesTable.compteNum, req.params.compteNum), isNull(journalEntriesTable.ecritureLet)))
    .orderBy(asc(journalEntriesTable.ecritureDate));

  res.json(rows);
});

const lettrageInputSchema = z.object({ entryIds: z.array(z.string().uuid()).min(2).max(50) });

// Rapproche un groupe d'ecritures du MEME compte dont la somme debit = somme
// credit (soldees entre elles) — ex: facture + reglement client. N'altere
// aucun montant, ajoute seulement ecritureLet/dateLet (voir schema).
comptabiliteRouter.post("/lettrage", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = lettrageInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const entries = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.licenceId, licenceId), inArray(journalEntriesTable.id, parsed.data.entryIds)));

  if (entries.length !== parsed.data.entryIds.length) {
    res.status(404).json({ error: "Une ou plusieurs ecritures introuvables" });
    return;
  }
  if (entries.some((e) => e.ecritureLet)) {
    res.status(409).json({ error: "Au moins une ecriture est deja lettree" });
    return;
  }
  const compteNum = entries[0].compteNum;
  if (entries.some((e) => e.compteNum !== compteNum)) {
    res.status(400).json({ error: "Toutes les ecritures doivent porter sur le meme compte" });
    return;
  }
  const totalDebit = entries.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    res.status(409).json({ error: `Le groupe ne se solde pas (debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)})` });
    return;
  }

  const existingCodes = await db
    .selectDistinct({ ecritureLet: journalEntriesTable.ecritureLet })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.licenceId, licenceId));
  const code = codeFromIndex(existingCodes.filter((c) => c.ecritureLet).length);

  const now = new Date().toISOString().slice(0, 10);
  await db
    .update(journalEntriesTable)
    .set({ ecritureLet: code, dateLet: now })
    .where(and(eq(journalEntriesTable.licenceId, licenceId), inArray(journalEntriesTable.id, parsed.data.entryIds)));

  res.json({ code, entryIds: parsed.data.entryIds });
});

// Annule un lettrage (erreur de rapprochement) — efface ecritureLet/dateLet,
// ne touche a aucun montant.
comptabiliteRouter.post("/lettrage/:code/annuler", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  await db
    .update(journalEntriesTable)
    .set({ ecritureLet: null, dateLet: null })
    .where(and(eq(journalEntriesTable.licenceId, licenceId), eq(journalEntriesTable.ecritureLet, req.params.code)));

  res.json({ ok: true });
});

const JOURNAL_LABELS: Record<string, string> = { AC: "Achats", VE: "Ventes", OD: "Operations diverses" };

function yyyymmdd(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// Export FEC — 18 colonnes DGFiP (art. A47 A-1 LPF), tabulation, UTF-8.
// exercice=YYYY optionnel (filtre par annee d'ecriture) ; sans filtre = tout.
comptabiliteRouter.get("/fec", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
  const exercice = req.query.exercice ? Number(req.query.exercice) : undefined;

  const conditions = [eq(journalEntriesTable.licenceId, licenceId)];
  if (exercice) {
    conditions.push(gte(journalEntriesTable.ecritureDate, `${exercice}-01-01`));
    conditions.push(lte(journalEntriesTable.ecritureDate, `${exercice}-12-31`));
  }

  const rows = await db
    .select()
    .from(journalEntriesTable)
    .where(and(...conditions))
    .orderBy(asc(journalEntriesTable.ecritureNum), asc(journalEntriesTable.id));

  const HEADER = [
    "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib",
    "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
    "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
  ];

  const lines = rows.map((r) =>
    [
      r.journalCode,
      JOURNAL_LABELS[r.journalCode] ?? r.journalCode,
      String(r.ecritureNum),
      yyyymmdd(r.ecritureDate),
      r.compteNum,
      r.compteLib,
      "", // CompAuxNum — pas de sous-compte auxiliaire en Phase 2
      "", // CompAuxLib
      r.pieceRef,
      yyyymmdd(r.pieceDate),
      r.ecritureLib,
      Number(r.debit).toFixed(2).replace(".", ","),
      Number(r.credit).toFixed(2).replace(".", ","),
      r.ecritureLet ?? "",
      r.dateLet ? yyyymmdd(r.dateLet) : "",
      yyyymmdd(r.ecritureDate), // ValidDate — ecritures immuables des la creation
      "", // Montantdevise — mono-devise EUR
      "", // Idevise
    ].join("\t"),
  );

  const siren = (licence?.siret ?? "").replace(/\D/g, "").slice(0, 9) || "000000000";
  const filename = `${siren}FEC${yyyymmdd(new Date())}.txt`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send([HEADER.join("\t"), ...lines].join("\r\n"));
});
