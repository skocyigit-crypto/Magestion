import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, licencesTable, usersTable } from "@magestion/db";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt.js";
import { extractUser } from "../middleware/extractUser.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

const registerSchema = z.object({
  entreprise: z.string().min(1).max(200),
  nom: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(256),
});

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

// Auto-inscription : cree une nouvelle licence (tenant) ET son premier
// utilisateur (SUPER_ADMIN de cette licence) en une seule requete publique.
// Plan TRIAL par defaut (valeur par defaut du schema licences), essai 14 jours.
authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Un compte existe deja avec cet email" });
    return;
  }

  const [licence] = await db
    .insert(licencesTable)
    .values({ nom: parsed.data.entreprise, trialEndsAt: new Date(Date.now() + TRIAL_DURATION_MS) })
    .returning();

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ licenceId: licence.id, email, passwordHash, nom: parsed.data.nom, role: "SUPER_ADMIN" })
    .returning();

  const token = signToken({ sub: user.id, licenceId: user.licenceId, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, nom: user.nom, role: user.role, licenceId: user.licenceId },
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  // Message generique volontaire (pas de "email inconnu" vs "mdp incorrect")
  // pour ne pas confirmer l'existence d'un compte.
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Identifiants incorrects" });
    return;
  }

  const token = signToken({ sub: user.id, licenceId: user.licenceId, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, nom: user.nom, role: user.role, licenceId: user.licenceId },
  });
});

// Route montee ici (avant le extractUser global de index.ts) donc protegee
// explicitement route-par-route : permet aux sessions deja connectees avant
// l'ajout d'un champ cote client (ex: cache localStorage) de se rafraichir
// sans devoir se reconnecter.
authRouter.get("/me", extractUser, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.sub)).limit(1);
  if (!user || !user.active) {
    res.status(401).json({ error: "Utilisateur introuvable ou desactive" });
    return;
  }
  res.json({ id: user.id, email: user.email, nom: user.nom, role: user.role, licenceId: user.licenceId });
});
