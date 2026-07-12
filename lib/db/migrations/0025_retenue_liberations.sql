-- Suivi de la liberation des retenues de garantie (le montant retenu par
-- situation existe deja — voir situations.taux_retenue_garantie). Additif/idempotent.

CREATE TABLE IF NOT EXISTS retenue_liberations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  montant numeric(12, 2) NOT NULL,
  date_liberation date NOT NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retenue_liberations_project_id ON retenue_liberations(project_id);
