-- Suivi des dechets de chantier (diagnostic dechets obligatoire depuis 2022,
-- bordereau BSD/BSDD pour les dechets dangereux). Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE type_dechet AS ENUM ('INERTES', 'NON_DANGEREUX_NON_INERTES', 'DANGEREUX');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE destination_dechet AS ENUM ('REEMPLOI', 'RECYCLAGE', 'VALORISATION_ENERGETIQUE', 'ELIMINATION', 'STOCKAGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS dechets_chantier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  type_dechet type_dechet NOT NULL,
  nature_dechet text NOT NULL,
  quantite numeric(10, 2) NOT NULL,
  unite text NOT NULL DEFAULT 'tonnes',
  collecteur text,
  fournisseur_id uuid REFERENCES fournisseurs(id),
  date_enlevement date NOT NULL,
  destination destination_dechet NOT NULL DEFAULT 'RECYCLAGE',
  bordereau_numero text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dechets_chantier_licence_idx ON dechets_chantier (licence_id);
CREATE INDEX IF NOT EXISTS dechets_chantier_project_idx ON dechets_chantier (project_id);
