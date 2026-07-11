import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, usersTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";

export const usersRouter = Router();

// "users" est absent de la matrice RBAC -> seul SUPER_ADMIN passe (bypass).
usersRouter.use(requireModuleAccess("users"));

const ROLE_ENUM = z.enum(["SUPER_ADMIN", "COMMERCIAL", "TERRAIN", "COMPTABILITE"]);

usersRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      nom: usersTable.nom,
      role: usersTable.role,
      active: usersTable.active,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.licenceId, licenceId));

  res.json(rows);
});

const userInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
  nom: z.string().min(1).max(200),
  role: ROLE_ENUM,
});

usersRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = userInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Un utilisateur avec cet email existe deja" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [created] = await db
    .insert(usersTable)
    .values({ licenceId, email, passwordHash, nom: parsed.data.nom, role: parsed.data.role })
    .returning();

  const { passwordHash: _omit, ...safe } = created;
  res.status(201).json(safe);
});

const userUpdateSchema = z.object({
  nom: z.string().min(1).max(200).optional(),
  role: ROLE_ENUM.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(256).optional(),
});

// Pas de DELETE : desactivation reversible via PATCH { active: false } (regle produit).
usersRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  // Un SUPER_ADMIN ne peut pas se desactiver ou se retrograder lui-meme
  // (evite un lockout : plus personne ne pourrait re-donner acces).
  if (req.params.id === req.user!.sub && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "SUPER_ADMIN"))) {
    res.status(400).json({ error: "Vous ne pouvez pas retrograder ou desactiver votre propre compte" });
    return;
  }

  const { password, ...rest } = parsed.data;
  const [updated] = await db
    .update(usersTable)
    .set({
      ...rest,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(usersTable.id, req.params.id), eq(usersTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }
  const { passwordHash: _omit, ...safe } = updated;
  res.json(safe);
});
