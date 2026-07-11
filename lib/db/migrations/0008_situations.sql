-- Situations de travaux (hakedis) + retenue de garantie. Additif/idempotent.
-- Immutabilite gere cote application (routes/situations.ts) : au-dela de
-- BROUILLON (statut VALIDEE), plus aucune modification.

DO $$ BEGIN
  CREATE TYPE situation_statut AS ENUM ('BROUILLON', 'VALIDEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  numero_situation integer NOT NULL,
  marche_ht numeric(12, 2) NOT NULL,
  avancement_percent numeric(5, 2) NOT NULL,
  taux_tva numeric(4, 2) NOT NULL DEFAULT 20,
  taux_retenue_garantie numeric(4, 2) NOT NULL DEFAULT 5,
  statut situation_statut NOT NULL DEFAULT 'BROUILLON',
  date_situation date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_situations_licence_id ON situations(licence_id);
CREATE INDEX IF NOT EXISTS idx_situations_project_id ON situations(project_id);
