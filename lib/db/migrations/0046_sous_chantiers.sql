-- Sous-chantiers : decoupage spatial d'un chantier (batiments/lots pouvant
-- avancer en parallele), distinct des phases temporelles (chantier_phases).
-- Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE sous_chantier_statut AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINE', 'SUSPENDU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sous_chantiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  nom text NOT NULL,
  description text,
  budget_estime_ht numeric(12, 2),
  avancement_percent numeric(5, 2) NOT NULL DEFAULT 0,
  statut sous_chantier_statut NOT NULL DEFAULT 'EN_ATTENTE',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sous_chantiers_project_idx ON sous_chantiers (project_id);
