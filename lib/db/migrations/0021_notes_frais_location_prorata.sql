-- Notes de frais employes, locations de materiel externe, et compte prorata
-- de chantier (charges communes reparties entre sous-traitants). Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE note_frais_categorie AS ENUM ('DEPLACEMENT', 'REPAS', 'MATERIEL', 'HEBERGEMENT', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE note_frais_statut AS ENUM ('SOUMISE', 'VALIDEE', 'REMBOURSEE', 'REFUSEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notes_de_frais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  project_id uuid REFERENCES projects(id),
  date_depense date NOT NULL,
  categorie note_frais_categorie NOT NULL DEFAULT 'AUTRE',
  motif text NOT NULL,
  montant numeric(10, 2) NOT NULL,
  statut note_frais_statut NOT NULL DEFAULT 'SOUMISE',
  date_remboursement timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_de_frais_licence_id ON notes_de_frais(licence_id);
CREATE INDEX IF NOT EXISTS idx_notes_de_frais_employee_id ON notes_de_frais(employee_id);

DO $$ BEGIN
  CREATE TYPE location_materiel_statut AS ENUM ('EN_COURS', 'TERMINEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS locations_materiel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid REFERENCES projects(id),
  designation text NOT NULL,
  fournisseur text NOT NULL,
  date_debut date NOT NULL,
  date_fin date,
  cout_journalier_ht numeric(10, 2) NOT NULL DEFAULT 0,
  statut location_materiel_statut NOT NULL DEFAULT 'EN_COURS',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locations_materiel_licence_id ON locations_materiel(licence_id);
CREATE INDEX IF NOT EXISTS idx_locations_materiel_project_id ON locations_materiel(project_id);

CREATE TABLE IF NOT EXISTS chantier_sous_traitants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  sous_traitant_id uuid NOT NULL REFERENCES sous_traitants(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chantier_sous_traitants_project_id ON chantier_sous_traitants(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_chantier_sous_traitant ON chantier_sous_traitants(project_id, sous_traitant_id);

CREATE TABLE IF NOT EXISTS prorata_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  libelle text NOT NULL,
  montant_ht numeric(10, 2) NOT NULL,
  taux_tva numeric(4, 2) NOT NULL DEFAULT 20,
  date_operation date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prorata_charges_project_id ON prorata_charges(project_id);
