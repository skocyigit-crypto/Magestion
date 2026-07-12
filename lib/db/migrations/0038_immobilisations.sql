-- Registre des immobilisations (materiel, vehicules...) avec amortissement
-- lineaire calcule a la volee (voir lib/amortissement.ts). Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE immobilisation_categorie AS ENUM ('MATERIEL', 'VEHICULE', 'INFORMATIQUE', 'MOBILIER', 'OUTILLAGE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE immobilisation_statut AS ENUM ('EN_SERVICE', 'CEDE', 'REBUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS immobilisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  code text NOT NULL,
  designation text NOT NULL,
  categorie immobilisation_categorie NOT NULL DEFAULT 'AUTRE',
  compte_comptable varchar(10) NOT NULL DEFAULT '2154',
  date_acquisition date NOT NULL,
  date_mise_en_service date,
  valeur_acquisition numeric(12, 2) NOT NULL DEFAULT 0,
  duree_amortissement integer NOT NULL DEFAULT 5,
  fournisseur_id uuid REFERENCES fournisseurs(id),
  localisation text,
  affecte_a text,
  statut immobilisation_statut NOT NULL DEFAULT 'EN_SERVICE',
  date_cession date,
  valeur_cession numeric(12, 2),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immobilisations_licence_idx ON immobilisations (licence_id);
