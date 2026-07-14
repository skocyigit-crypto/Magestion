import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db, employeesTable, employeeHabilitationsTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { storageAdapter } from "../lib/storage.js";
import { IMAGE_MIME_TO_EXT, IMAGE_EXT_TO_CONTENT_TYPE, detectImageExt } from "../lib/imageValidation.js";

export const employeesRouter = Router();
employeesRouter.use(requireModuleAccess("employees"));

const ROLE_ENUM = z.enum([
  "CHEF_CHANTIER", "CONDUCTEUR_TRAVAUX", "MACON", "ELECTRICIEN", "PLOMBIER",
  "CHARPENTIER", "COUVREUR", "PEINTRE", "CARRELEUR", "MANOEUVRE", "AUTRE",
]);

// Palette distincte (rotation par nombre d'employes existants) — chaque
// nouvel employe recoit automatiquement une couleur differente de la precedente.
const PALETTE = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const employeeInputSchema = z.object({
  nom: z.string().min(1).max(100),
  prenom: z.string().min(1).max(100),
  role: ROLE_ENUM.optional(),
  telephone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  tauxHoraire: z.number().nonnegative().max(999999.99).optional(),
});

const employeeUpdateSchema = employeeInputSchema.partial().extend({
  statut: z.enum(["SUR_CHANTIER", "EN_ROUTE", "ABSENT", "INDISPONIBLE", "CONGE"]).optional(),
  active: z.boolean().optional(),
  consentementReconnaissanceFaciale: z.boolean().optional(),
});

employeesRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const onlyInactive = req.query.onlyInactive === "true";
  const rows = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.licenceId, licenceId), eq(employeesTable.active, !onlyInactive)));

  res.json(rows);
});

employeesRouter.post("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = employeeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const existingCount = await db.select().from(employeesTable).where(eq(employeesTable.licenceId, licenceId));
  const couleur = PALETTE[existingCount.length % PALETTE.length];

  const [created] = await db
    .insert(employeesTable)
    .values({
      licenceId,
      nom: parsed.data.nom,
      prenom: parsed.data.prenom,
      role: parsed.data.role,
      telephone: parsed.data.telephone,
      email: parsed.data.email || undefined,
      tauxHoraire: parsed.data.tauxHoraire?.toString(),
      couleur,
    })
    .returning();

  res.status(201).json(created);
});

// Echeances RH sous 30 jours (deja expirees incluses) tous employes/tous
// types confondus — route litterale, doit rester AVANT /:id (sinon "echeances"
// serait interprete comme un id). Calcule a la volee depuis date_validite,
// meme principe que /relances/a-faire.
employeesRouter.get("/echeances", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const habilitations = await db
    .select()
    .from(employeeHabilitationsTable)
    .where(and(eq(employeeHabilitationsTable.licenceId, licenceId), eq(employeeHabilitationsTable.active, true)));
  const employees = await db.select().from(employeesTable).where(and(eq(employeesTable.licenceId, licenceId), eq(employeesTable.active, true)));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const dans30Jours = new Date();
  dans30Jours.setDate(dans30Jours.getDate() + 30);

  const echeances = habilitations
    .filter((h) => employeeById.has(h.employeeId) && new Date(h.dateValidite) <= dans30Jours)
    .map((h) => {
      const employee = employeeById.get(h.employeeId)!;
      const joursRestants = Math.floor((new Date(h.dateValidite).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        id: h.id,
        employeeId: h.employeeId,
        employeeNom: `${employee.prenom} ${employee.nom}`,
        type: h.type,
        libelle: h.libelle,
        dateValidite: h.dateValidite,
        joursRestants,
        expiree: joursRestants < 0,
      };
    })
    .sort((a, b) => a.joursRestants - b.joursRestants);

  res.json(echeances);
});

employeesRouter.get("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, req.params.id), eq(employeesTable.licenceId, licenceId)))
    .limit(1);

  if (!employee) {
    res.status(404).json({ error: "Employe introuvable" });
    return;
  }
  res.json(employee);
});

employeesRouter.get("/:id/habilitations", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db
    .select()
    .from(employeeHabilitationsTable)
    .where(and(eq(employeeHabilitationsTable.employeeId, req.params.id), eq(employeeHabilitationsTable.licenceId, licenceId), eq(employeeHabilitationsTable.active, true)));
  res.json(rows);
});

const habilitationInputSchema = z.object({
  type: z.enum(["CARTE_BTP", "VISITE_MEDICALE", "CACES", "TITRE_SEJOUR", "HABILITATION_ELECTRIQUE", "AUTRE"]),
  libelle: z.string().max(200).optional(),
  dateValidite: z.string(),
});

employeesRouter.post("/:id/habilitations", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = habilitationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, req.params.id), eq(employeesTable.licenceId, licenceId))).limit(1);
  if (!employee) {
    res.status(404).json({ error: "Employe introuvable" });
    return;
  }

  const [created] = await db
    .insert(employeeHabilitationsTable)
    .values({ licenceId, employeeId: employee.id, type: parsed.data.type, libelle: parsed.data.libelle, dateValidite: parsed.data.dateValidite })
    .returning();
  res.status(201).json(created);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle
// produit) — un renouvellement se saisit comme une NOUVELLE habilitation,
// l'ancienne est archivee pour garder l'historique des echeances passees.
employeesRouter.patch("/habilitations/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const [updated] = await db
    .update(employeeHabilitationsTable)
    .set({ active: parsed.data.active })
    .where(and(eq(employeeHabilitationsTable.id, req.params.id), eq(employeeHabilitationsTable.licenceId, licenceId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Habilitation introuvable" });
    return;
  }
  res.json(updated);
});

// Pas de DELETE : archivage uniquement via PATCH { active: false } (regle produit).
employeesRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = employeeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { tauxHoraire, consentementReconnaissanceFaciale, ...rest } = parsed.data;

  // Retrait du consentement = suppression immediate de la photo de reference
  // (donnee biometrique) : la conserver sans consentement actif n'a pas de
  // base legale, contrairement aux autres champs employe.
  let photoUrlUpdate: { photoUrl: null } | undefined;
  if (consentementReconnaissanceFaciale === false) {
    const [existing] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, req.params.id), eq(employeesTable.licenceId, licenceId))).limit(1);
    if (existing?.photoUrl) {
      await storageAdapter.remove(existing.photoUrl);
      photoUrlUpdate = { photoUrl: null };
    }
  }

  const [updated] = await db
    .update(employeesTable)
    .set({
      ...rest,
      ...(consentementReconnaissanceFaciale !== undefined ? { consentementReconnaissanceFaciale } : {}),
      ...photoUrlUpdate,
      ...(tauxHoraire !== undefined ? { tauxHoraire: tauxHoraire.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(employeesTable.id, req.params.id), eq(employeesTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Employe introuvable" });
    return;
  }
  res.json(updated);
});

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIME_TO_EXT[file.mimetype]) {
      cb(new Error("Format non supporte (PNG, JPEG ou WEBP uniquement)"));
      return;
    }
    cb(null, true);
  },
});

// Photo de reference pour la reconnaissance faciale (voir routes/faceRecognition.ts).
// Le consentement doit avoir ete enregistre AVANT l'upload — jamais l'inverse,
// pour eviter qu'une photo biometrique transite/soit stockee sans base legale.
employeesRouter.post("/:id/photo", photoUpload.single("photo"), async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  if (!req.file) {
    res.status(400).json({ error: "Fichier requis" });
    return;
  }

  // req.params.id degrade en `string | string[]` ici a cause du multer chaine
  // en argument positionnel (meme quirk Express 5 documente dans lib/rbac.ts).
  const employeeId = req.params.id as string;
  const [employee] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, employeeId), eq(employeesTable.licenceId, licenceId))).limit(1);
  if (!employee) {
    res.status(404).json({ error: "Employe introuvable" });
    return;
  }
  if (!employee.consentementReconnaissanceFaciale) {
    res.status(403).json({ error: "Consentement a la reconnaissance faciale requis avant l'ajout d'une photo de reference" });
    return;
  }

  const ext = detectImageExt(req.file.buffer);
  if (!ext) {
    res.status(400).json({ error: "Fichier invalide : le contenu ne correspond a aucun format image supporte (PNG, JPEG, WEBP)" });
    return;
  }

  const photoUrl = join(licenceId, "employes", `${employee.id}-${randomUUID()}.${ext}`);
  await storageAdapter.save(photoUrl, req.file.buffer);
  if (employee.photoUrl) await storageAdapter.remove(employee.photoUrl);

  const [updated] = await db
    .update(employeesTable)
    .set({ photoUrl, updatedAt: new Date() })
    .where(eq(employeesTable.id, employee.id))
    .returning();
  res.status(201).json(updated);
});

employeesRouter.get("/:id/photo", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [employee] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, req.params.id), eq(employeesTable.licenceId, licenceId))).limit(1);
  if (!employee?.photoUrl) {
    res.status(404).json({ error: "Aucune photo" });
    return;
  }

  const ext = employee.photoUrl.split(".").pop() ?? "";
  res.setHeader("Content-Type", IMAGE_EXT_TO_CONTENT_TYPE[ext] ?? "application/octet-stream");
  storageAdapter.sendFile(employee.photoUrl, res);
});
