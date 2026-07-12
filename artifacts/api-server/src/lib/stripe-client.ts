import Stripe from "stripe";

// Mode SIMULATION explicite quand STRIPE_SECRET_KEY est absent (dev sans
// compte Stripe reel) — voir routes/billing.ts. Jamais de mode simulation
// silencieux en production : la clef est requise pour tout paiement reel.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const STRIPE_SIMULATION_MODE = stripe === null;

export type PlanKey = "STARTER" | "PME" | "ENTREPRISE";

// Un plan est "disponible" a l'achat des que son Price ID Stripe est
// configure (ou toujours en mode simulation, pour pouvoir tester le flux
// complet sans compte Stripe).
export function priceIdForPlan(plan: PlanKey): string | null {
  return process.env[`STRIPE_PRICE_${plan}`] ?? null;
}
