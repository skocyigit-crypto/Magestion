-- Devis (teklifler). Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE devis_statut AS ENUM ('BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid REFERENCES projects(id),
  numero text NOT NULL,
  client text NOT NULL,
  objet text NOT NULL,
  statut devis_statut NOT NULL DEFAULT 'BROUILLON',
  montant_ht numeric(12, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(4, 2) NOT NULL DEFAULT 20,
  date_envoi timestamptz,
  date_reponse timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devis_licence_id ON devis(licence_id);
