-- Gestion de taches (todo interne, rattachable a un chantier/employe).
-- Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE tache_priorite AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tache_statut AS ENUM ('A_FAIRE', 'EN_COURS', 'TERMINEE', 'ANNULEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS taches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  titre text NOT NULL,
  description text,
  priorite tache_priorite NOT NULL DEFAULT 'NORMALE',
  statut tache_statut NOT NULL DEFAULT 'A_FAIRE',
  project_id uuid REFERENCES projects(id),
  assigne_id uuid REFERENCES employees(id),
  echeance date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS taches_licence_idx ON taches (licence_id);
CREATE INDEX IF NOT EXISTS taches_statut_idx ON taches (licence_id, statut);
