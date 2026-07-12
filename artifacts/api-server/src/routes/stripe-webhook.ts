import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, licencesTable, stripeEventsProcessedTable } from "@magestion/db";
import { stripe } from "../lib/stripe-client.js";
import type Stripe from "stripe";

export const stripeWebhookRouter = Router();

// Route publique (pas de extractUser) : Stripe authentifie via la
// signature HMAC (Stripe-Signature + STRIPE_WEBHOOK_SECRET), pas un JWT.
// Necessite le corps BRUT (pas express.json()) pour verifier cette
// signature — voir index.ts, ce router est monte AVANT express.json().
stripeWebhookRouter.post("/", async (req, res) => {
  if (!stripe) {
    res.status(503).json({ error: "Stripe non configure (mode simulation)" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    res.status(400).json({ error: "Signature ou secret webhook manquant" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    res.status(400).json({ error: `Signature invalide: ${err instanceof Error ? err.message : "erreur inconnue"}` });
    return;
  }

  // Idempotence : Stripe retente un evenement non acquitte (200) — on ignore
  // silencieusement un event.id deja traite plutot que de rejouer l'effet.
  const [already] = await db
    .select({ eventId: stripeEventsProcessedTable.eventId })
    .from(stripeEventsProcessedTable)
    .where(eq(stripeEventsProcessedTable.eventId, event.id))
    .limit(1);
  if (already) {
    res.json({ received: true, duplicate: true });
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const licenceId = session.client_reference_id ?? session.metadata?.licenceId;
      const planKey = session.metadata?.planKey as "STARTER" | "PME" | "ENTREPRISE" | undefined;
      if (licenceId && planKey) {
        await db
          .update(licencesTable)
          .set({
            plan: planKey,
            status: "ACTIF",
            stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
            stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
            updatedAt: new Date(),
          })
          .where(eq(licencesTable.id, licenceId));
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await db
        .update(licencesTable)
        .set({ status: "SUSPENDU", updatedAt: new Date() })
        .where(eq(licencesTable.stripeSubscriptionId, subscription.id));
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
      if (subscriptionId) {
        await db
          .update(licencesTable)
          .set({ status: "SUSPENDU", updatedAt: new Date() })
          .where(eq(licencesTable.stripeSubscriptionId, subscriptionId));
      }
      break;
    }
    default:
      break;
  }

  await db.insert(stripeEventsProcessedTable).values({ eventId: event.id, type: event.type });
  res.json({ received: true });
});
