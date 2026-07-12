-- Registre client centralise (CRM leger), independant des chantiers.
-- Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE client_type AS ENUM ('PARTICULIER', 'PROFESSIONNEL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  type client_type NOT NULL DEFAULT 'PARTICULIER',
  nom text NOT NULL,
  email text,
  telephone text,
  adresse text,
  code_postal varchar(10),
  ville text,
  siret varchar(14),
  tva_intracommunautaire text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_licence_idx ON clients (licence_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS projects_client_idx ON projects (client_id);
