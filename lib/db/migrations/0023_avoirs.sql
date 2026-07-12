-- Avoirs (notes de credit) emis contre une facture deja emise. Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE avoir_statut AS ENUM ('BROUILLON', 'EMIS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS avoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  facture_id uuid NOT NULL REFERENCES factures(id),
  numero text NOT NULL,
  motif text NOT NULL,
  montant_ht numeric(12, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(4, 2) NOT NULL DEFAULT 20,
  statut avoir_statut NOT NULL DEFAULT 'BROUILLON',
  date_emission timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avoirs_licence_id ON avoirs(licence_id);
CREATE INDEX IF NOT EXISTS idx_avoirs_facture_id ON avoirs(facture_id);
CREATE UNIQUE INDEX IF NOT EXISTS avoirs_licence_numero_uniq ON avoirs(licence_id, numero);

CREATE TABLE IF NOT EXISTS avoir_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avoir_id uuid NOT NULL REFERENCES avoirs(id),
  ordre integer NOT NULL DEFAULT 0,
  designation text NOT NULL,
  quantite numeric(10, 2) NOT NULL DEFAULT 1,
  unite text NOT NULL DEFAULT 'u',
  prix_unitaire_ht numeric(12, 2) NOT NULL DEFAULT 0,
  remise_percent numeric(5, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avoir_lignes_avoir_id ON avoir_lignes(avoir_id);
