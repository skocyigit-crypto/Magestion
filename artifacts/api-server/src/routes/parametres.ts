import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, licencesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { isValidSiret } from "../lib/siret.js";
import { storageAdapter } from "../lib/storage.js";

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

const LOGO_EXT_TO_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

// Le mimetype declare par le client (header multipart) est trivialement
// falsifiable — on verifie les "magic bytes" reels du fichier pour confirmer
// que le contenu correspond vraiment au type annonce avant de le stocker.
function detectImageExt(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

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

  const ext = detectImageExt(req.file.buffer);
  if (!ext) {
    res.status(400).json({ error: "Fichier invalide : le contenu ne correspond a aucun format image supporte (PNG, JPEG, WEBP)" });
    return;
  }

  const [existing] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);

  const filename = `logo-${randomUUID()}.${ext}`;
  const logoChemin = join(licenceId, filename);
  await storageAdapter.save(logoChemin, req.file.buffer);

  // Nettoie l'ancien fichier physique (jamais garder de fichiers orphelins sur disque).
  if (existing?.logoChemin) {
    await storageAdapter.remove(existing.logoChemin);
  }

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

  const ext = licence.logoChemin.split(".").pop() ?? "";
  res.setHeader("Content-Type", LOGO_EXT_TO_CONTENT_TYPE[ext] ?? "application/octet-stream");
  storageAdapter.sendFile(licence.logoChemin, res);
});
