import { Router } from "express";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db, journalEntriesTable, licencesTable, planComptableTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";

export const comptabiliteRouter = Router();

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
comptabiliteRouter.get("/balance", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select({
      compteNum: journalEntriesTable.compteNum,
      compteLib: journalEntriesTable.compteLib,
      totalDebit: sql<string>`SUM(${journalEntriesTable.debit})`,
      totalCredit: sql<string>`SUM(${journalEntriesTable.credit})`,
    })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.licenceId, licenceId))
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
      "", // EcritureLet — lettrage non implemente
      "", // DateLet
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
