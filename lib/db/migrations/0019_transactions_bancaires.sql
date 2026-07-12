-- Rapprochement bancaire (import manuel CSV — pas d'agregateur bancaire
-- tiers configure). Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE rapprochement_statut AS ENUM ('NON_RAPPROCHE', 'RAPPROCHE_AUTO', 'RAPPROCHE_MANUEL', 'IGNORE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS transactions_bancaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  date_operation date NOT NULL,
  libelle text NOT NULL,
  montant numeric(12, 2) NOT NULL,
  reference text,
  import_batch_id uuid NOT NULL,
  rapprochement_statut rapprochement_statut NOT NULL DEFAULT 'NON_RAPPROCHE',
  facture_id uuid REFERENCES factures(id),
  depense_id uuid REFERENCES depenses(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_bancaires_licence_id ON transactions_bancaires(licence_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bancaires_facture_id ON transactions_bancaires(facture_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bancaires_depense_id ON transactions_bancaires(depense_id);
