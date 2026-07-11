import type { Response } from "express";
import type { AuthTokenPayload } from "./jwt.js";

// Platform owner = SUPER_ADMIN sans licence — reserve aux endpoints cross-tenant
// explicites (analytics, admin licences). Ne JAMAIS utiliser ce check pour
// autoriser un acces en lecture/ecriture sur une ressource tenant ordinaire.
export function isPlatformOwner(user: AuthTokenPayload): boolean {
  return user.role === "SUPER_ADMIN" && user.licenceId === null;
}

// Pour les routes CRUD tenant (projets, clients, devis...) : licenceId
// obligatoire dans le WHERE. Contrairement a une god-view null=all-tenants,
// ici pas de bypass implicite — le platform owner n'a pas d'acces via ce
// helper (routes cross-tenant dediees separement, cf isPlatformOwner()).
export function requireLicenceId(user: AuthTokenPayload, res: Response): string | null {
  if (!user.licenceId) {
    res.status(403).json({ error: "Compte non rattache a une licence" });
    return null;
  }
  return user.licenceId;
}
