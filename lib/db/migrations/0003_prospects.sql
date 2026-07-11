-- Prospects / CRM commercial. Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE prospect_statut AS ENUM ('NOUVEAU', 'CONTACTE', 'RDV_PLANIFIE', 'DEVIS_ENVOYE', 'NEGOCIATION', 'GAGNE', 'PERDU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE prospect_urgence AS ENUM ('BASSE', 'NORMALE', 'URGENTE', 'TRES_URGENTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  nom text NOT NULL,
  contact text,
  telephone varchar(30),
  email text,
  adresse text,
  code_postal varchar(10),
  budget_estime numeric(12, 2) NOT NULL DEFAULT 0,
  distance_km numeric(6, 1),
  urgence prospect_urgence NOT NULL DEFAULT 'NORMALE',
  statut prospect_statut NOT NULL DEFAULT 'NOUVEAU',
  score integer NOT NULL DEFAULT 50,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_licence_id ON prospects(licence_id);
