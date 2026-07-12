-- Declarations de TVA periodiques (snapshot fige a la validation). Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE declaration_tva_statut AS ENUM ('BROUILLON', 'VALIDEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS declarations_tva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  tva_collectee numeric(12, 2) NOT NULL,
  tva_deductible numeric(12, 2) NOT NULL,
  tva_a_payer numeric(12, 2) NOT NULL,
  statut declaration_tva_statut NOT NULL DEFAULT 'BROUILLON',
  date_validation timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_declarations_tva_licence_id ON declarations_tva(licence_id);
