-- Chantiers/Projets. Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE project_categorie AS ENUM ('RENOVATION', 'CONSTRUCTION_NEUVE', 'ISOLATION', 'EXTENSION', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_statut AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINE', 'SUSPENDU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  nom text NOT NULL,
  client text NOT NULL,
  adresse text,
  code_postal varchar(10),
  budget_estime_ht numeric(12, 2) NOT NULL DEFAULT 0,
  objectif_marge_percent numeric(5, 2) NOT NULL DEFAULT 0,
  categorie project_categorie NOT NULL DEFAULT 'AUTRE',
  statut project_statut NOT NULL DEFAULT 'EN_ATTENTE',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_licence_id ON projects(licence_id);
