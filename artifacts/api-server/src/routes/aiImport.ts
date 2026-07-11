import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { extractJsonFromImage, GeminiNotConfiguredError } from "../lib/gemini.js";
import { requireLicenceId } from "../lib/tenantScope.js";

export const aiImportRouter = Router();

// Memoire uniquement (pas de persistance disque) : l'image sert juste a
// l'extraction, elle n'est pas stockee comme document.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PROMPT_DEPENSE = `Tu analyses une photo ou un scan de facture fournisseur BTP francaise.
Extrait les informations suivantes et reponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "fournisseur": "nom de l'entreprise emettrice",
  "objet": "description courte de la prestation/fourniture",
  "montantHt": nombre (montant HT en euros, sans symbole),
  "tauxTva": nombre (0, 5.5, 10 ou 20 — le taux de TVA le plus proche de celui indique),
  "dateEcheance": "YYYY-MM-DD ou null si absente"
}
Si une information est illisible ou absente, utilise null (ou 0 pour les nombres). Ne devine pas de valeurs non presentes sur le document.`;

const extractedSchema = z.object({
  fournisseur: z.string().nullable(),
  objet: z.string().nullable(),
  montantHt: z.number().nullable(),
  tauxTva: z.number().nullable(),
  dateEcheance: z.string().nullable(),
});

aiImportRouter.post("/depense", upload.single("file"), async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  if (!req.file) {
    res.status(400).json({ error: "Fichier requis" });
    return;
  }

  try {
    const raw = await extractJsonFromImage(req.file.buffer, req.file.mimetype, PROMPT_DEPENSE);
    const parsed = extractedSchema.safeParse(raw);
    if (!parsed.success) {
      res.status(502).json({ error: "Reponse IA invalide, reessayez ou saisissez manuellement" });
      return;
    }
    res.json(parsed.data);
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error("[ai-import]", err);
    res.status(502).json({ error: "Erreur lors de l'analyse IA, reessayez ou saisissez manuellement" });
  }
});
