import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, licencesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { isValidSiret } from "../lib/siret.js";

export const parametresRouter = Router();

// "parametres" est absent de la matrice RBAC -> seul SUPER_ADMIN passe (bypass),
// meme logique que users.ts : les coordonnees legales de l'entreprise ne
// doivent etre modifiables que par un administrateur.
parametresRouter.use(requireModuleAccess("parametres"));

parametresRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
  if (!licence) {
    res.status(404).json({ error: "Licence introuvable" });
    return;
  }
  res.json(licence);
});

const parametresUpdateSchema = z.object({
  nom: z.string().min(1).max(200).optional(),
  siret: z.string().refine(isValidSiret, { message: "SIRET invalide (14 chiffres + cle de controle)" }).optional().or(z.literal("")),
  adresse: z.string().max(300).optional(),
  codePostal: z.string().max(10).optional(),
  ville: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  telephone: z.string().max(30).optional(),
  tvaIntracommunautaire: z.string().max(20).optional(),
});

parametresRouter.patch("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = parametresUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { siret, email, ...rest } = parsed.data;
  const [updated] = await db
    .update(licencesTable)
    .set({
      ...rest,
      ...(siret !== undefined ? { siret: siret || null } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(licencesTable.id, licenceId))
    .returning();

  res.json(updated);
});
