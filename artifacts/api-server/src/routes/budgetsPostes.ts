import { Router } from "express";
import { z } from "zod";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, budgetsPostesTable, journalEntriesTable, planComptableTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const budgetsPostesRouter = Router();
budgetsPostesRouter.use(requireModuleAccess("budgetsPostes"));

const budgetInputSchema = z.object({
  compteNum: z.string().min(1).max(20),
  exercice: z.number().int().min(2000).max(2100),
  montantBudgeteHt: z.number(),
  notes: z.string().optional(),
});

budgetsPostesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const exercice = req.query.exercice ? Number(req.query.exercice) : undefined;
  const conditions = [eq(budgetsPostesTable.licenceId, licenceId)];
  if (exercice) conditions.push(eq(budgetsPostesTable.exercice, exercice));

  const rows = await db
    .select()
    .from(budgetsPostesTable)
    .where(and(...conditions));
  res.json(rows);
});

budgetsPostesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = budgetInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [compte] = await db.select().from(planComptableTable).where(eq(planComptableTable.compteNum, parsed.data.compteNum)).limit(1);
  if (!compte) {
    res.status(400).json({ error: "Compte comptable inconnu" });
    return;
  }

  const { montantBudgeteHt, ...rest } = parsed.data;
  try {
    const [created] = await db
      .insert(budgetsPostesTable)
      .values({ licenceId, ...rest, montantBudgeteHt: montantBudgeteHt.toString() })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      res.status(409).json({ error: "Un budget existe deja pour ce compte sur cet exercice" });
      return;
    }
    throw err;
  }
});

budgetsPostesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ montantBudgeteHt: z.number().optional(), notes: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { montantBudgeteHt, notes } = parsed.data;
  const [updated] = await db
    .update(budgetsPostesTable)
    .set({
      ...(montantBudgeteHt !== undefined ? { montantBudgeteHt: montantBudgeteHt.toString() } : {}),
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(budgetsPostesTable.id, req.params.id), eq(budgetsPostesTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Budget introuvable" });
    return;
  }
  res.json(updated);
});

// Realise vs budgete par compte sur un exercice : jointure des budgets_postes
// avec la somme des ecritures (journal_entries) du meme compte sur l'annee.
// Un compte peut apparaitre cote realise sans budget defini (ecart = -realise).
budgetsPostesRouter.get("/realise", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const exercice = req.query.exercice ? Number(req.query.exercice) : new Date().getFullYear();

  const budgets = await db.select().from(budgetsPostesTable).where(and(eq(budgetsPostesTable.licenceId, licenceId), eq(budgetsPostesTable.exercice, exercice)));
  const planComptable = await db.select().from(planComptableTable);
  const libelleParCompte = new Map(planComptable.map((c) => [c.compteNum, c.libelle]));

  const realiseRows = await db
    .select({
      compteNum: journalEntriesTable.compteNum,
      compteLib: journalEntriesTable.compteLib,
      totalDebit: sql<string>`SUM(${journalEntriesTable.debit})`,
      totalCredit: sql<string>`SUM(${journalEntriesTable.credit})`,
    })
    .from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.licenceId, licenceId),
        gte(journalEntriesTable.ecritureDate, `${exercice}-01-01`),
        lte(journalEntriesTable.ecritureDate, `${exercice}-12-31`),
      ),
    )
    .groupBy(journalEntriesTable.compteNum, journalEntriesTable.compteLib);

  const realiseParCompte = new Map(
    realiseRows.map((r) => [r.compteNum, { compteLib: r.compteLib, realise: Number(r.totalDebit) - Number(r.totalCredit) }]),
  );

  const comptes = new Set<string>([...budgets.map((b) => b.compteNum), ...realiseRows.map((r) => r.compteNum)]);

  const result = Array.from(comptes).map((compteNum) => {
    const budget = budgets.find((b) => b.compteNum === compteNum);
    const realise = realiseParCompte.get(compteNum);
    const montantBudgeteHt = budget ? Number(budget.montantBudgeteHt) : 0;
    const montantRealiseHt = realise ? Math.abs(realise.realise) : 0;
    return {
      compteNum,
      compteLib: realise?.compteLib ?? libelleParCompte.get(compteNum) ?? "",
      budgetId: budget?.id ?? null,
      montantBudgeteHt,
      montantRealiseHt,
      ecart: montantBudgeteHt - montantRealiseHt,
    };
  });

  result.sort((a, b) => a.compteNum.localeCompare(b.compteNum));
  res.json(result);
});
