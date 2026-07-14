-- Demandes d'achat : workflow d'autorisation avant creation d'une commande
-- fournisseur (EN_ATTENTE -> APPROUVEE -> CONVERTIE, ou -> REJETEE).
-- Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE demande_achat_statut AS ENUM ('EN_ATTENTE', 'APPROUVEE', 'REJETEE', 'CONVERTIE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS demandes_achat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid REFERENCES projects(id),
  demandeur_id uuid REFERENCES employees(id),
  objet text NOT NULL,
  quantite_estimee text,
  montant_estime_ht numeric(12, 2),
  statut demande_achat_statut NOT NULL DEFAULT 'EN_ATTENTE',
  motif_rejet text,
  commande_id uuid REFERENCES commandes(id),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demandes_achat_licence_idx ON demandes_achat (licence_id);
CREATE INDEX IF NOT EXISTS demandes_achat_project_idx ON demandes_achat (project_id);
CREATE INDEX IF NOT EXISTS demandes_achat_statut_idx ON demandes_achat (statut);
