import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, licencesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { isValidSiret } from "../lib/siret.js";
import { STORAGE_DIR } from "../lib/storage.js";

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

const LOGO_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo
  fileFilter: (_req, file, cb) => {
    if (!LOGO_MIME_TO_EXT[file.mimetype]) {
      cb(new Error("Format non supporte (PNG, JPEG ou WEBP uniquement)"));
      return;
    }
    cb(null, true);
  },
});

parametresRouter.post("/logo", logoUpload.single("logo"), async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  if (!req.file) {
    res.status(400).json({ error: "Fichier requis" });
    return;
  }

  const [existing] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);

  const dir = join(STORAGE_DIR, licenceId);
  mkdirSync(dir, { recursive: true });
  const ext = LOGO_MIME_TO_EXT[req.file.mimetype];
  const filename = `logo-${randomUUID()}.${ext}`;
  const fullPath = join(dir, filename);
  await writeFile(fullPath, req.file.buffer);

  // Nettoie l'ancien fichier physique (jamais garder de fichiers orphelins sur disque).
  if (existing?.logoChemin) {
    try {
      unlinkSync(join(STORAGE_DIR, existing.logoChemin));
    } catch {
      // Fichier deja absent : rien a faire.
    }
  }

  const logoChemin = join(licenceId, filename);
  const [updated] = await db
    .update(licencesTable)
    .set({ logoChemin, updatedAt: new Date() })
    .where(eq(licencesTable.id, licenceId))
    .returning();

  res.status(201).json(updated);
});

parametresRouter.get("/logo", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
  if (!licence?.logoChemin) {
    res.status(404).json({ error: "Aucun logo" });
    return;
  }

  res.sendFile(join(STORAGE_DIR, licence.logoChemin));
});
