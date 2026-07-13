import { Router } from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, documentsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { storageAdapter } from "../lib/storage.js";
import { extractJsonFromImage, GeminiNotConfiguredError } from "../lib/gemini.js";

export const documentsRouter = Router();
documentsRouter.use(requireModuleAccess("documents"));

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo

// Zone Privee : seuls SUPER_ADMIN et COMPTABILITE voient/manipulent les
// documents marques confidentiel=true, quel que soit leur role d'ecriture
// habituel sur le module documents (TERRAIN/COMMERCIAL en sont exclus).
function canAccessConfidentiel(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "COMPTABILITE";
}

// Buffer en memoire (pas multer.diskStorage) : le fichier est ensuite ecrit
// via storageAdapter, portable disque local (dev) / Google Cloud Storage
// (prod, voir lib/storage.ts) sans dupliquer la logique d'upload.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE } });

const TYPE_ENUM = z.enum(["CONTRAT", "ASSURANCE", "PERMIS", "FACTURE", "PLAN", "AUTRE"]);
const ENTITY_TYPE_ENUM = z.enum(["PROJECT", "EMPLOYEE", "VEHICLE", "SOUS_TRAITANT", "GENERAL"]);

const OCR_PROMPT = `Tu analyses un document administratif ou technique d'une entreprise BTP francaise (contrat, attestation d'assurance, permis de construire, facture, plan...).
Reponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "type": "CONTRAT" | "ASSURANCE" | "PERMIS" | "FACTURE" | "PLAN" | "AUTRE",
  "nom": "titre court et descriptif du document (ex: 'Attestation RC Pro 2026 - ACME Assurances')",
  "dateExpiration": "YYYY-MM-DD ou null si aucune date d'expiration/validite visible"
}
Choisis le type le plus proche meme si incertain. Ne devine pas de date si elle n'apparait pas explicitement sur le document.`;

const ocrSchema = z.object({
  type: TYPE_ENUM.nullable(),
  nom: z.string().nullable(),
  dateExpiration: z.string().nullable(),
});

// Classement automatique best-effort : n'importe quel echec (IA non
// configuree, reponse invalide, quota depasse...) est avale ici et ne doit
// jamais empecher l'upload — seulement priver l'utilisateur de la
// suggestion, qu'il renseigne alors manuellement comme avant.
async function tryClassifyDocument(buffer: Buffer, mimeType: string): Promise<{ type: z.infer<typeof TYPE_ENUM>; nom: string | null; dateExpiration: string | null } | null> {
  if (!/^(image\/|application\/pdf)/.test(mimeType)) return null;
  try {
    const raw = await extractJsonFromImage(buffer, mimeType, OCR_PROMPT);
    const parsed = ocrSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.type) return null;
    return { type: parsed.data.type, nom: parsed.data.nom, dateExpiration: parsed.data.dateExpiration };
  } catch (err) {
    if (!(err instanceof GeminiNotConfiguredError)) console.warn("[documents] classification IA echouee:", err);
    return null;
  }
}

documentsRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.licenceId, licenceId), eq(documentsTable.active, !onlyInactive)));
  const visible = canAccessConfidentiel(req.user!.role) ? rows : rows.filter((d) => !d.confidentiel);
  res.json(visible);
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
      // multer transmet les champs texte du multipart en string ("true"/"false"),
      // jamais en booleen natif — d'ou le preprocess plutot que z.boolean() seul.
      confidentiel: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  // Routage automatique : uniquement quand l'utilisateur n'a pas deja
  // renseigne un type explicite (jamais de re-classement silencieux d'un
  // choix humain).
  let suggested: Awaited<ReturnType<typeof tryClassifyDocument>> = null;
  if (!parsed.data.type) {
    suggested = await tryClassifyDocument(req.file.buffer, req.file.mimetype);
  }

  // Nom physique aleatoire (jamais le nom original) : evite path traversal
  // et collisions ; le nom d'origine est conserve en base (documents.nom).
  const filename = `${randomUUID()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const cheminFichier = join(licenceId, filename);
  await storageAdapter.save(cheminFichier, req.file.buffer);

  const [created] = await db
    .insert(documentsTable)
    .values({
      licenceId,
      nom: parsed.data.nom || suggested?.nom || req.file.originalname,
      type: parsed.data.type || suggested?.type,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      cheminFichier,
      tailleOctets: req.file.size,
      mimeType: req.file.mimetype,
      dateExpiration: parsed.data.dateExpiration || suggested?.dateExpiration || undefined,
      classificationIa: !!suggested,
      confidentiel: parsed.data.confidentiel ?? false,
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
  if (doc.confidentiel && !canAccessConfidentiel(req.user!.role)) {
    res.status(403).json({ error: "Document reserve a la Zone Privee" });
    return;
  }

  storageAdapter.sendFile(doc.cheminFichier, res, doc.nom);
});

const documentUpdateSchema = z.object({
  nom: z.string().min(1).max(300).optional(),
  type: TYPE_ENUM.optional(),
  entityType: ENTITY_TYPE_ENUM.optional(),
  entityId: z.string().uuid().optional(),
  dateExpiration: z.string().optional(),
  active: z.boolean().optional(),
  confidentiel: z.boolean().optional(),
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
// Renommer/reclasser un document ne touche jamais au fichier physique
// (cheminFichier), seuls les metadonnees sont modifiables ici. Un document
// verrouille (WORM, voir /verrouiller) refuse TOUTE modification, y compris
// l'archivage — un document a valeur legale doit rester visible et intact.
documentsRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = documentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [existing] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Document introuvable" });
    return;
  }
  if (existing.confidentiel && !canAccessConfidentiel(req.user!.role)) {
    res.status(403).json({ error: "Document reserve a la Zone Privee" });
    return;
  }
  if (existing.verrouille) {
    res.status(423).json({ error: "Document verrouille (WORM) — plus aucune modification possible" });
    return;
  }

  const [updated] = await db
    .update(documentsTable)
    .set(parsed.data)
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});

// Verrouillage WORM definitif : scelle le fichier (empreinte SHA-256) et
// bloque toute modification future (voir PATCH ci-dessus). Aucune route de
// deverrouillage — c'est le sens meme du WORM, pour les documents a valeur
// probante (contrats signes, attestations d'assurance, permis...).
documentsRouter.post("/:id/verrouiller", async (req, res) => {
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
  if (doc.confidentiel && !canAccessConfidentiel(req.user!.role)) {
    res.status(403).json({ error: "Document reserve a la Zone Privee" });
    return;
  }
  if (doc.verrouille) {
    res.status(409).json({ error: "Document deja verrouille" });
    return;
  }

  const buffer = await storageAdapter.readBuffer(doc.cheminFichier);
  const hash = createHash("sha256").update(buffer).digest("hex");

  const [updated] = await db
    .update(documentsTable)
    .set({ verrouille: true, verrouilleAt: new Date(), verrouillePar: req.user!.sub, hashSha256: hash })
    .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});

// Recalcule le SHA-256 du fichier actuel et le compare a l'empreinte scellee
// au verrouillage — detecte toute alteration du fichier sur disque depuis.
documentsRouter.get("/:id/verifier-integrite", async (req, res) => {
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
  if (doc.confidentiel && !canAccessConfidentiel(req.user!.role)) {
    res.status(403).json({ error: "Document reserve a la Zone Privee" });
    return;
  }
  if (!doc.verrouille || !doc.hashSha256) {
    res.status(409).json({ error: "Document non verrouille — aucune empreinte de reference" });
    return;
  }

  const currentBuffer = await storageAdapter.readBuffer(doc.cheminFichier);
  const currentHash = createHash("sha256").update(currentBuffer).digest("hex");

  res.json({ intact: currentHash === doc.hashSha256, hashReference: doc.hashSha256, hashActuel: currentHash });
});
