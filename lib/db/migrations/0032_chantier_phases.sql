-- Planning Gantt simplifie par chantier (phases sequencees, sans graphe de
-- dependances). Additif/idempotent.

CREATE TABLE IF NOT EXISTS chantier_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  nom text NOT NULL,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  avancement_percent numeric(5, 2) NOT NULL DEFAULT 0,
  ordre integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chantier_phases_project_idx ON chantier_phases (project_id, licence_id);
