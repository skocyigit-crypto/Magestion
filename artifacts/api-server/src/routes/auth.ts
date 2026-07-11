import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, usersTable } from "@magestion/db";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
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
