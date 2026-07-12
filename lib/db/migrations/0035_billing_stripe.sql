-- Facturation Stripe (abonnements SaaS). Additif/idempotent.
-- STRIPE_SECRET_KEY absent -> routes/billing.ts fonctionne en mode
-- SIMULATION (upgrade de plan immediat, sans appel Stripe reel).

ALTER TABLE licences ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE licences ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE licences ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS stripe_events_processed (
  event_id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
