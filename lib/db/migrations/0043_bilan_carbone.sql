-- Bilan carbone chantier (reporting simplifie, methode inspiree ADEME).
-- Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE categorie_carbone AS ENUM ('TRANSPORT', 'MATERIAUX', 'ENERGIE', 'DECHETS', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bilan_carbone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  categorie categorie_carbone NOT NULL,
  poste text NOT NULL,
  quantite numeric(12, 2) NOT NULL,
  unite text NOT NULL,
  facteur_emission_kg_co2 numeric(10, 4) NOT NULL,
  emissions_kg_co2 numeric(12, 2) NOT NULL,
  date_operation date NOT NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bilan_carbone_licence_idx ON bilan_carbone (licence_id);
CREATE INDEX IF NOT EXISTS bilan_carbone_project_idx ON bilan_carbone (project_id);
