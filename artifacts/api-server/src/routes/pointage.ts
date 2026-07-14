import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, pointageTable, employeesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { storageAdapter } from "../lib/storage.js";
import { IMAGE_MIME_TO_EXT, detectImageExt } from "../lib/imageValidation.js";
import { matchFaceAgainstReferences, GeminiNotConfiguredError } from "../lib/gemini.js";

export const pointageRouter = Router();
pointageRouter.use(requireModuleAccess("pointage"));

pointageRouter.get("/", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const rows = await db.select().from(pointageTable).where(eq(pointageTable.licenceId, licenceId));
  res.json(rows);
});

const arriveeSchema = z.object({ employeeId: z.string().uuid(), projectId: z.string().uuid().optional() });

pointageRouter.post("/arrivee", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = arriveeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  // Garde-fou : pas de double pointage ouvert (arrivee sans depart) pour le meme employe.
  const [ouvert] = await db
    .select()
    .from(pointageTable)
    .where(and(eq(pointageTable.employeeId, parsed.data.employeeId), eq(pointageTable.licenceId, licenceId), isNull(pointageTable.heureDepart)))
    .limit(1);
  if (ouvert) {
    res.status(409).json({ error: "Un pointage est deja ouvert pour cet employe (arrivee sans depart enregistre)" });
    return;
  }

  const [created] = await db
    .insert(pointageTable)
    .values({ licenceId, employeeId: parsed.data.employeeId, projectId: parsed.data.projectId })
    .returning();

  res.status(201).json(created);
});

pointageRouter.post("/:id/depart", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [existing] = await db
    .select()
    .from(pointageTable)
    .where(and(eq(pointageTable.id, req.params.id), eq(pointageTable.licenceId, licenceId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Pointage introuvable" });
    return;
  }
  if (existing.heureDepart) {
    res.status(409).json({ error: "Depart deja enregistre" });
    return;
  }

  const [updated] = await db
    .update(pointageTable)
    .set({ heureDepart: new Date() })
    .where(and(eq(pointageTable.id, req.params.id), eq(pointageTable.licenceId, licenceId)))
    .returning();

  res.json(updated);
});

const pointageUpdateSchema = z.object({
  heureArrivee: z.string().optional(),
  heureDepart: z.string().nullable().optional(),
  projectId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

// Correction manuelle (oubli de pointage, erreur de saisie) : pas de DELETE,
// archivage reversible via { active: false } (regle produit).
pointageRouter.patch("/:id", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = pointageUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const { heureArrivee, heureDepart, ...rest } = parsed.data;
  const [updated] = await db
    .update(pointageTable)
    .set({
      ...rest,
      ...(heureArrivee !== undefined ? { heureArrivee: new Date(heureArrivee) } : {}),
      ...(heureDepart !== undefined ? { heureDepart: heureDepart ? new Date(heureDepart) : null } : {}),
    })
    .where(and(eq(pointageTable.id, req.params.id), eq(pointageTable.licenceId, licenceId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Pointage introuvable" });
    return;
  }
  res.json(updated);
});

const faceUpload = multer({
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

// Pointage par reconnaissance faciale (borne/tablette a l'entree du chantier) :
// compare la photo prise a l'instant contre les photos de reference des
// employes ayant EXPLICITEMENT consenti (voir routes/employees.ts). Toggle
// automatique arrivee/depart, comme un pointage manuel classique. Un employe
// sans consentement/photo n'est jamais candidat au matching — pas de fallback
// "on essaie quand meme".
pointageRouter.post("/reconnaissance-faciale", faceUpload.single("photo"), async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  if (!req.file) {
    res.status(400).json({ error: "Photo requise" });
    return;
  }
  const capturedExt = detectImageExt(req.file.buffer);
  if (!capturedExt) {
    res.status(400).json({ error: "Fichier invalide : le contenu ne correspond a aucun format image supporte (PNG, JPEG, WEBP)" });
    return;
  }

  const candidats = await db
    .select({ id: employeesTable.id, nom: employeesTable.nom, prenom: employeesTable.prenom, photoUrl: employeesTable.photoUrl })
    .from(employeesTable)
    .where(and(
      eq(employeesTable.licenceId, licenceId),
      eq(employeesTable.active, true),
      eq(employeesTable.consentementReconnaissanceFaciale, true),
    ));
  const eligibles = candidats.filter((c): c is typeof c & { photoUrl: string } => !!c.photoUrl);

  if (eligibles.length === 0) {
    res.status(400).json({ error: "Aucun employe n'a de photo de reference avec consentement enregistre" });
    return;
  }

  try {
    const references = await Promise.all(
      eligibles.map(async (e) => ({
        employeeId: e.id,
        buffer: await storageAdapter.readBuffer(e.photoUrl),
        mimeType: e.photoUrl.endsWith(".png") ? "image/png" : e.photoUrl.endsWith(".webp") ? "image/webp" : "image/jpeg",
      })),
    );

    const match = await matchFaceAgainstReferences(
      { buffer: req.file.buffer, mimeType: req.file.mimetype },
      references,
    );

    if (!match.matched || !match.employeeId) {
      res.json({ matched: false, confidence: match.confidence });
      return;
    }

    const employee = eligibles.find((e) => e.id === match.employeeId)!;

    // Meme toggle qu'un pointage manuel : pas de pointage ouvert -> arrivee,
    // sinon -> depart (voir POST /arrivee et POST /:id/depart ci-dessus).
    const [ouvert] = await db
      .select()
      .from(pointageTable)
      .where(and(eq(pointageTable.employeeId, employee.id), eq(pointageTable.licenceId, licenceId), isNull(pointageTable.heureDepart)))
      .limit(1);

    const pointage = ouvert
      ? (await db.update(pointageTable).set({ heureDepart: new Date() }).where(eq(pointageTable.id, ouvert.id)).returning())[0]
      : (await db.insert(pointageTable).values({ licenceId, employeeId: employee.id }).returning())[0];

    res.json({
      matched: true,
      confidence: match.confidence,
      employee: { id: employee.id, nom: employee.nom, prenom: employee.prenom },
      action: ouvert ? "depart" : "arrivee",
      pointage,
    });
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error("[pointage/reconnaissance-faciale]", err);
    res.status(502).json({ error: "Erreur reconnaissance faciale, reessayez ou pointez manuellement" });
  }
});
