import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, licencesTable } from "@magestion/db";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { STRIPE_SIMULATION_MODE, priceIdForPlan, stripe, type PlanKey } from "../lib/stripe-client.js";
import { invalidateLicenceGateCache } from "../middleware/checkLicenceGate.js";

export const billingRouter = Router();
// "billing" absent de la matrice RBAC -> seul SUPER_ADMIN passe (bypass) —
// la gestion de l'abonnement d'une licence n'est jamais deleguee a un role
// operationnel (meme pattern que "users"/"parametres").
billingRouter.use(requireModuleAccess("billing"));

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

const PLANS: { key: PlanKey; nom: string; prixMensuelEur: number; features: string[] }[] = [
  { key: "STARTER", nom: "Starter", prixMensuelEur: 29, features: ["1 utilisateur", "Chantiers illimites", "Devis & factures"] },
  { key: "PME", nom: "PME", prixMensuelEur: 79, features: ["5 utilisateurs", "Comptabilite complete", "Facturation electronique 2026"] },
  { key: "ENTREPRISE", nom: "Entreprise", prixMensuelEur: 199, features: ["Utilisateurs illimites", "RGPD & audit", "Support prioritaire"] },
];

billingRouter.get("/plans", async (_req, res) => {
  res.json(
    PLANS.map((p) => ({
      ...p,
      disponible: STRIPE_SIMULATION_MODE || priceIdForPlan(p.key) !== null,
    })),
  );
});

billingRouter.get("/status", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
  if (!licence) {
    res.status(404).json({ error: "Licence introuvable" });
    return;
  }

  const joursRestantsEssai = licence.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(licence.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  res.json({
    plan: licence.plan,
    status: licence.status,
    trialEndsAt: licence.trialEndsAt,
    joursRestantsEssai,
    essaiExpire: licence.plan === "TRIAL" && joursRestantsEssai === 0,
    abonneStripe: !!licence.stripeSubscriptionId,
    simulation: STRIPE_SIMULATION_MODE,
  });
});

const checkoutInputSchema = z.object({
  planKey: z.enum(["STARTER", "PME", "ENTREPRISE"]),
});

billingRouter.post("/checkout", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = checkoutInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
  if (!licence) {
    res.status(404).json({ error: "Licence introuvable" });
    return;
  }

  // Mode simulation : upgrade immediat, sans paiement reel — permet de
  // tester tout le flux plan-aware sans compte Stripe (voir lib/stripe-client.ts).
  if (STRIPE_SIMULATION_MODE) {
    const [updated] = await db
      .update(licencesTable)
      .set({ plan: parsed.data.planKey, status: "ACTIF", updatedAt: new Date() })
      .where(eq(licencesTable.id, licenceId))
      .returning();
    invalidateLicenceGateCache(licenceId);
    res.json({ simulation: true, url: null, plan: updated.plan });
    return;
  }

  const priceId = priceIdForPlan(parsed.data.planKey);
  if (!priceId) {
    res.status(400).json({ error: `Plan "${parsed.data.planKey}" non disponible (STRIPE_PRICE_${parsed.data.planKey} manquant)` });
    return;
  }

  const session = await stripe!.checkout.sessions.create({
    mode: "subscription",
    customer: licence.stripeCustomerId ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/parametres?billing=success`,
    cancel_url: `${APP_URL}/parametres?billing=cancel`,
    client_reference_id: licenceId,
    metadata: { licenceId, planKey: parsed.data.planKey },
  });

  res.json({ simulation: false, url: session.url });
});

billingRouter.post("/portal", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId)).limit(1);
  if (!licence) {
    res.status(404).json({ error: "Licence introuvable" });
    return;
  }

  if (STRIPE_SIMULATION_MODE) {
    res.json({ simulation: true, url: null });
    return;
  }

  if (!licence.stripeCustomerId) {
    res.status(409).json({ error: "Aucun abonnement Stripe actif pour cette licence" });
    return;
  }

  const session = await stripe!.billingPortal.sessions.create({
    customer: licence.stripeCustomerId,
    return_url: `${APP_URL}/parametres`,
  });

  res.json({ simulation: false, url: session.url });
});
