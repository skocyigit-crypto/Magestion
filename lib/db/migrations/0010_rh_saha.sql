-- Phase 3 : Equipe/RH, Pointage, Planning Personnel, Sous-traitants, Securite.
-- Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE employee_role AS ENUM ('CHEF_CHANTIER', 'CONDUCTEUR_TRAVAUX', 'MACON', 'ELECTRICIEN', 'PLOMBIER', 'CHARPENTIER', 'COUVREUR', 'PEINTRE', 'CARRELEUR', 'MANOEUVRE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE employee_statut AS ENUM ('SUR_CHANTIER', 'EN_ROUTE', 'ABSENT', 'INDISPONIBLE', 'CONGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  nom text NOT NULL,
  prenom text NOT NULL,
  role employee_role NOT NULL DEFAULT 'AUTRE',
  telephone varchar(30),
  email text,
  taux_horaire numeric(8, 2) NOT NULL DEFAULT 0,
  couleur varchar(7) NOT NULL DEFAULT '#F59E0B',
  statut employee_statut NOT NULL DEFAULT 'ABSENT',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_licence_id ON employees(licence_id);

CREATE TABLE IF NOT EXISTS pointage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  project_id uuid REFERENCES projects(id),
  date_jour date NOT NULL DEFAULT CURRENT_DATE,
  heure_arrivee timestamptz NOT NULL DEFAULT now(),
  heure_depart timestamptz,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_pointage_licence_id ON pointage(licence_id);
CREATE INDEX IF NOT EXISTS idx_pointage_employee_id ON pointage(employee_id);

DO $$ BEGIN
  CREATE TYPE affectation_type AS ENUM ('CHANTIER', 'CONGE', 'MALADIE', 'FORMATION', 'DEPLACEMENT', 'REPOS', 'BUREAU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS planning_affectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  project_id uuid REFERENCES projects(id),
  date date NOT NULL,
  type affectation_type NOT NULL DEFAULT 'CHANTIER',
  chef_equipe boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_planning_affectations_licence_id ON planning_affectations(licence_id);
CREATE INDEX IF NOT EXISTS idx_planning_affectations_employee_date ON planning_affectations(employee_id, date);

CREATE TABLE IF NOT EXISTS sous_traitants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  raison_sociale text NOT NULL,
  siret varchar(14) NOT NULL,
  specialite text,
  contact text,
  telephone varchar(30),
  email text,
  assurance_decennale_validite date,
  urssaf_validite date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sous_traitants_licence_id ON sous_traitants(licence_id);

DO $$ BEGIN
  CREATE TYPE incident_gravite AS ENUM ('FAIBLE', 'MOYENNE', 'ELEVEE', 'CRITIQUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS securite_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid REFERENCES projects(id),
  titre text NOT NULL,
  description text,
  type_incident text NOT NULL,
  gravite incident_gravite NOT NULL DEFAULT 'FAIBLE',
  date_incident timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_securite_incidents_licence_id ON securite_incidents(licence_id);
