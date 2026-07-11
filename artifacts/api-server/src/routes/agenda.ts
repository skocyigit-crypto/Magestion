import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, agendaEventsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";

export const agendaRouter = Router();

const TYPE_ENUM = z.enum(["RDV", "VISITE_CHANTIER", "APPEL", "REUNION", "SIGNATURE", "LIVRAISON", "RELANCE", "AUTRE"]);
const STATUT_ENUM = z.enum(["PLANIFIE", "CONFIRME", "EN_COURS", "EFFECTUE", "ANNULE", "REPORTE"]);
const PRIORITE_ENUM = z.enum(["BASSE", "NORMALE", "HAUTE", "URGENTE"]);

const eventInputSchema = z.object({
  titre: z.string().min(1).max(300),
  type: TYPE_ENUM.optional(),
  priorite: PRIORITE_ENUM.optional(),
  dateHeure: z.string(),
  dureeMinutes: z.number().positive().max(1440).optional(),
  projectId: z.string().uuid().optional(),
  prospectId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

agendaRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db.select().from(agendaEventsTable).where(and(eq(agendaEventsTable.licenceId, licenceId), eq(agendaEventsTable.active, true)));
  res.json(rows);
});

function overlaps(aStart: Date, aDurMin: number, bStart: Date, bDurMin: number): boolean {
  const aEnd = new Date(aStart.getTime() + aDurMin * 60000);
  const bEnd = new Date(bStart.getTime() + bDurMin * 60000);
  return aStart < bEnd && bStart < aEnd;
}

agendaRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = eventInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const dateHeure = new Date(parsed.data.dateHeure);
  const dureeMinutes = parsed.data.dureeMinutes ?? 60;

  // Detection de conflit : deux rendez-vous ne peuvent pas se chevaucher pour
  // la meme licence (agenda commercial partage, pas par utilisateur en Phase 5).
  const existing = await db
    .select()
    .from(agendaEventsTable)
    .where(and(eq(agendaEventsTable.licenceId, licenceId), eq(agendaEventsTable.active, true)));
  const conflit = existing.find((e) => overlaps(dateHeure, dureeMinutes, new Date(e.dateHeure), e.dureeMinutes));
  if (conflit) {
    res.status(409).json({ error: `Conflit avec un autre rendez-vous : "${conflit.titre}"` });
    return;
  }

  const [created] = await db
    .insert(agendaEventsTable)
    .values({
      licenceId,
      titre: parsed.data.titre,
      type: parsed.data.type,
      priorite: parsed.data.priorite,
      dateHeure,
      dureeMinutes,
      projectId: parsed.data.projectId,
      prospectId: parsed.data.prospectId,
      notes: parsed.data.notes,
    })
    .returning();

  res.status(201).json(created);
});

agendaRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ statut: STATUT_ENUM.optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(agendaEventsTable)
    .set(parsed.data)
    .where(and(eq(agendaEventsTable.id, req.params.id), eq(agendaEventsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Evenement introuvable" });
    return;
  }
  res.json(updated);
});
