-- Commandes fournisseurs. Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE commande_statut AS ENUM ('BROUILLON', 'ENVOYEE', 'CONFIRMEE', 'LIVREE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS commandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid REFERENCES projects(id),
  fournisseur text NOT NULL,
  objet text NOT NULL,
  statut commande_statut NOT NULL DEFAULT 'BROUILLON',
  montant_ht numeric(12, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(4, 2) NOT NULL DEFAULT 20,
  date_livraison_prevue date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commandes_licence_id ON commandes(licence_id);
