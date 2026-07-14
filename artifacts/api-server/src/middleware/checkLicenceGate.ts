import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, licencesTable } from "@magestion/db";
import { isPlatformOwner } from "../lib/tenantScope.js";

// Chemins accessibles meme si la licence est suspendue/essai termine — sans
// quoi un client suspendu ne pourrait plus jamais consulter son statut ni
// payer pour se reactiver (auto-blocage irrecuperable sans passer par un
// super-admin). "/api/auth" n'a pas besoin d'etre liste ici : ce routeur est
// monte AVANT extractUser dans index.ts, donc jamais atteint par ce middleware.
const SAFE_PATH_PREFIXES = ["/api/billing"];

type GateInfo = { status: "ACTIF" | "SUSPENDU" | "ARCHIVE"; plan: string; trialEndsAt: Date | null };

// Ce middleware tourne sur (quasiment) chaque requete /api/* authentifiee —
// un aller-retour DB par requete serait un cout inutile pour une donnee qui
// ne change qu'au rythme des evenements Stripe/actions super-admin. Cache
// memoire process-local a TTL court, invalide explicitement par les points
// d'ecriture (stripe-webhook.ts, billing.ts, super-admin.ts) plutot que par
// expiration seule — coherent immediatement apres un paiement/reactivation.
const CACHE_TTL_MS = 30_000;
const gateCache = new Map<string, { info: GateInfo; expiresAt: number }>();

export function invalidateLicenceGateCache(licenceId: string): void {
  gateCache.delete(licenceId);
}

async function getGateInfo(licenceId: string): Promise<GateInfo | null> {
  const cached = gateCache.get(licenceId);
  if (cached && cached.expiresAt > Date.now()) return cached.info;

  const [licence] = await db
    .select({ status: licencesTable.status, plan: licencesTable.plan, trialEndsAt: licencesTable.trialEndsAt })
    .from(licencesTable)
    .where(eq(licencesTable.id, licenceId))
    .limit(1);
  if (!licence) return null;

  gateCache.set(licenceId, { info: licence, expiresAt: Date.now() + CACHE_TTL_MS });
  return licence;
}

// Bloque l'acces (lecture ET ecriture, la licence n'a pas de statut degrade
// intermediaire contrairement au plan tarifaire) si la licence est
// suspendue/archivee, ou si l'essai TRIAL est expire sans abonnement actif.
// Monte juste apres extractUser dans index.ts (voir garde-fou dans ce fichier).
export async function checkLicenceGate(req: Request, res: Response, next: NextFunction) {
  const user = req.user!;
  if (isPlatformOwner(user) || !user.licenceId) {
    next();
    return;
  }

  // req.path est relatif au point de montage ("/api") une fois dans ce
  // middleware — originalUrl conserve le prefixe complet, c'est lui qu'il
  // faut comparer aux SAFE_PATH_PREFIXES (qui incluent "/api/...").
  if (SAFE_PATH_PREFIXES.some((prefix) => req.originalUrl.startsWith(prefix))) {
    next();
    return;
  }

  const info = await getGateInfo(user.licenceId);
  if (!info) {
    res.status(403).json({ error: "Licence introuvable" });
    return;
  }

  if (info.status !== "ACTIF") {
    res.status(403).json({ error: "Licence suspendue — contactez le support ou regularisez le paiement.", code: "LICENCE_SUSPENDUE" });
    return;
  }

  if (info.plan === "TRIAL" && info.trialEndsAt && info.trialEndsAt.getTime() <= Date.now()) {
    res.status(403).json({ error: "Periode d'essai terminee — choisissez un abonnement pour continuer.", code: "ESSAI_TERMINE" });
    return;
  }

  next();
}
