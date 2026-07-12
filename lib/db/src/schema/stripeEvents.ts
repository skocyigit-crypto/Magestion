import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Idempotence des webhooks Stripe : Stripe retente un evenement non
// acquitte (200) — on rejoue le traitement seulement si event.id est inconnu
// ici, sinon on l'ignore silencieusement (voir routes/stripe-webhook.ts).
export const stripeEventsProcessedTable = pgTable("stripe_events_processed", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
