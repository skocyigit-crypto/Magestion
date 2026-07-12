import type { RequestHandler } from "express";

type Role = "SUPER_ADMIN" | "COMMERCIAL" | "TERRAIN" | "COMPTABILITE";
type Access = "read" | "write";

// Matrice de permissions par module (cf. docs/kullanim-kilavuzu roles) :
// SUPER_ADMIN a toujours acces complet (bypass, jamais dans la table).
// Un role absent d'un module = aucun acces (ni lecture ni ecriture).
const MODULE_ACCESS: Record<string, Partial<Record<Role, Access>>> = {
  chantiers: { COMMERCIAL: "read", TERRAIN: "write", COMPTABILITE: "read" },
  prospects: { COMMERCIAL: "write" },
  devis: { COMMERCIAL: "write" },
  factures: { COMPTABILITE: "write" },
  depenses: { COMPTABILITE: "write" },
  commandes: { COMPTABILITE: "write" },
  situations: { COMPTABILITE: "write", TERRAIN: "read" },
  comptabilite: { COMPTABILITE: "write" },
  employees: { TERRAIN: "write", COMPTABILITE: "read" },
  pointage: { TERRAIN: "write" },
  planningPersonnel: { TERRAIN: "write", COMMERCIAL: "read" },
  sousTraitants: { TERRAIN: "write", COMPTABILITE: "read" },
  securite: { TERRAIN: "write" },
  articles: { TERRAIN: "write", COMPTABILITE: "read" },
  ouvrages: { TERRAIN: "write", COMPTABILITE: "read" },
  stock: { TERRAIN: "write" },
  documents: { TERRAIN: "write", COMPTABILITE: "write", COMMERCIAL: "write" },
  vehicles: { TERRAIN: "write" },
  agenda: { COMMERCIAL: "write" },
  relances: { COMMERCIAL: "write" },
  aiImport: { COMPTABILITE: "write", COMMERCIAL: "write", TERRAIN: "write" },
  notesDeFrais: { TERRAIN: "write", COMPTABILITE: "write" },
  locationsMateriel: { TERRAIN: "write", COMPTABILITE: "read" },
  prorata: { COMPTABILITE: "write", TERRAIN: "read" },
  analyticsCommercial: { COMMERCIAL: "write", COMPTABILITE: "read" },
  // "users" et "parametres" delibere absents : gestion des utilisateurs et
  // coordonnees legales de l'entreprise = SUPER_ADMIN uniquement (bypass
  // ligne 44), aucun autre role n'y a jamais acces, meme en lecture.
};

const READ_METHODS = new Set(["GET", "HEAD"]);

// Monte en tete de CHAQUE router (router.use(requireModuleAccess("x")), une
// seule fois par fichier) plutot qu'en argument par route : evite un probleme
// connu d'inference TypeScript ou Express 5 degrade le typage de req.params
// quand un middleware generique est chaine en argument positionnel avec le
// handler d'une route parametree (req.params.id devient string | string[]).
// Le niveau requis est derive de la methode HTTP : GET/HEAD = read, sinon write.
export function requireModuleAccess(module: keyof typeof MODULE_ACCESS): RequestHandler {
  return (req, res, next) => {
    const user = req.user!;
    if (user.role === "SUPER_ADMIN") {
      next();
      return;
    }

    const required: Access = READ_METHODS.has(req.method) ? "read" : "write";
    const access = MODULE_ACCESS[module]?.[user.role as Role];
    const allowed = access === "write" || (access === "read" && required === "read");
    if (!allowed) {
      res.status(403).json({ error: "Acces refuse pour votre role" });
      return;
    }
    next();
  };
}
