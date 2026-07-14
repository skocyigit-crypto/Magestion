-- Bons de livraison : pourcentage cumule livre par commande (meme principe
-- que les situations de travaux appliquees aux devis). Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE bon_livraison_statut AS ENUM ('BROUILLON', 'VALIDE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bon_livraison_conformite AS ENUM ('CONFORME', 'NON_CONFORME', 'PARTIELLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bons_livraison (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  commande_id uuid NOT NULL REFERENCES commandes(id),
  numero_bl integer NOT NULL,
  commande_montant_ht numeric(12, 2) NOT NULL,
  pourcentage_livre numeric(5, 2) NOT NULL,
  statut bon_livraison_statut NOT NULL DEFAULT 'BROUILLON',
  conformite bon_livraison_conformite NOT NULL DEFAULT 'CONFORME',
  date_livraison date NOT NULL DEFAULT now(),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bons_livraison_licence_idx ON bons_livraison (licence_id);
CREATE INDEX IF NOT EXISTS bons_livraison_commande_idx ON bons_livraison (commande_id);
CREATE UNIQUE INDEX IF NOT EXISTS bons_livraison_commande_numero_idx ON bons_livraison (commande_id, numero_bl);
