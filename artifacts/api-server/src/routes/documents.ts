import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, documentsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { STORAGE_DIR } from "../lib/storage.js";

export const documentsRouter = Router();
documentsRouter.use(requireModuleAccess("documents"));

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const licenceId = req.user?.licenceId;
    if (!licenceId) {
      cb(new Error("Non authentifie"), "");
      return;
    }
    const dir = join(STORAGE_DIR, licenceId);
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Nom physique aleatoire (jamais le nom original) : evite path traversal
    // et collisions ; le nom d'origine est conserve en base (documents.nom).
    cb(null, `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_SIZE } });

const TYPE_ENUM = z.enum(["CONTRAT", "ASSURANCE", "PERMIS", "FACTURE", "PLAN", "AUTRE"]);
const ENTITY_TYPE_ENUM = z.enum(["PROJECT", "EMPLOYEE", "VEHICLE", "SOUS_TRAITANT", "GENERAL"]);

documentsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.licenceId, licenceId), eq(documentsTable.active, !onlyInactive)));
  res.json(rows);
});

documentsRouter.post("/", upload.single("file"), async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  if (!req.file) {
    res.status(400).json({ error: "Fichier requis" });
    return;
  }

  const parsed = z
    .object({
      nom: z.string().min(1).max(300).optional(),
      type: TYPE_ENUM.optional(),
      entityType: ENTITY_TYPE_ENUM.optional(),
      entityId: z.string().uuid().optional(),
      dateExpiration: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [created] = await db
    .insert(documentsTable)
    .values({
      licenceId,
      nom: parsed.data.nom || req.file.originalname,
      type: parsed.data.type,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      // Chemin relatif a STORAGE_DIR (portable) : <licenceId>/<nom-physique>.
      cheminFichier: join(licenceId, req.file.filename),
      tailleOctets: req.file.size,
      mimeType: req.file.mimetype,
      dateExpiration: parsed.data.dateExpiration,
    })
    .returning();

  res.status(201).json(created);
});

documentsRouter.get("/:id/download", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.licenceId, licenceId)))
    .limit(1);
  if (!doc) {
    res.status(404).json({ error: "Document introuvable" });
    return;
  }

  res.download(join(STORAGE_DIR, doc.cheminFichier), doc.nom);
});

const documentUpdateSchema = z.object({
  nom: z.string().min(1).max(300).optional(),
  type: TYPE_ENUM.optional(),
  entityType: ENTITY_TYPE_ENUM.optional(),
  entityId: z.string().uuid().optional(),
  dateExpiration: z.string().optional(),
  active: z.boolean().optional(),
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
// Renommer/reclasser un document ne touche jamais au fichier physique
// (cheminFichier), seuls les metadonnees sont modifiables ici.
documentsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = documentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(documentsTable)
    .set(parsed.data)
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Document introuvable" });
    return;
  }
  res.json(updated);
});
