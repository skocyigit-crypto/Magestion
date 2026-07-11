-- Phase 5 (partie 1) : Agenda commercial + Relances clients. Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE agenda_type AS ENUM ('RDV', 'VISITE_CHANTIER', 'APPEL', 'REUNION', 'SIGNATURE', 'LIVRAISON', 'RELANCE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agenda_statut AS ENUM ('PLANIFIE', 'CONFIRME', 'EN_COURS', 'EFFECTUE', 'ANNULE', 'REPORTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agenda_priorite AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid REFERENCES projects(id),
  prospect_id uuid REFERENCES prospects(id),
  titre text NOT NULL,
  type agenda_type NOT NULL DEFAULT 'RDV',
  statut agenda_statut NOT NULL DEFAULT 'PLANIFIE',
  priorite agenda_priorite NOT NULL DEFAULT 'NORMALE',
  date_heure timestamptz NOT NULL,
  duree_minutes integer NOT NULL DEFAULT 60,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agenda_events_licence_id ON agenda_events(licence_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_date_heure ON agenda_events(date_heure);

DO $$ BEGIN
  CREATE TYPE relance_type AS ENUM ('EMAIL', 'APPEL', 'SMS', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS relances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  devis_id uuid NOT NULL REFERENCES devis(id),
  type relance_type NOT NULL DEFAULT 'EMAIL',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_relances_licence_id ON relances(licence_id);
CREATE INDEX IF NOT EXISTS idx_relances_devis_id ON relances(devis_id);
