-- Factures clients. Additif/idempotent. Immutabilite gere cote application
-- (routes/factures.ts) : au-dela de BROUILLON, montant/objet non modifiables.

DO $$ BEGIN
  CREATE TYPE facture_statut AS ENUM ('BROUILLON', 'ENVOYEE', 'PAYEE', 'EN_RETARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid REFERENCES projects(id),
  devis_id uuid REFERENCES devis(id),
  numero text NOT NULL,
  client text NOT NULL,
  objet text NOT NULL,
  statut facture_statut NOT NULL DEFAULT 'BROUILLON',
  montant_ht numeric(12, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(4, 2) NOT NULL DEFAULT 20,
  date_echeance date,
  date_paiement timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factures_licence_id ON factures(licence_id);
CREATE INDEX IF NOT EXISTS idx_factures_devis_id ON factures(devis_id);
