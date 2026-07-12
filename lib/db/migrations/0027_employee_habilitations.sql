-- Documents/certifications RH a echeance (carte BTP, visite medicale, CACES,
-- titre de sejour, habilitation electrique...). Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE habilitation_type AS ENUM ('CARTE_BTP', 'VISITE_MEDICALE', 'CACES', 'TITRE_SEJOUR', 'HABILITATION_ELECTRIQUE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS employee_habilitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  type habilitation_type NOT NULL,
  libelle text,
  date_validite date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_habilitations_employee_id ON employee_habilitations(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_habilitations_licence_id ON employee_habilitations(licence_id);
