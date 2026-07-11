-- Depenses / factures fournisseurs. Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE depense_categorie AS ENUM ('MATERIAUX', 'MAIN_OEUVRE', 'SOUS_TRAITANCE', 'MATERIEL', 'ADMINISTRATIF', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE depense_statut AS ENUM ('A_VALIDER', 'BON_A_PAYER', 'PAYEE', 'EN_LITIGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS depenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid REFERENCES projects(id),
  fournisseur text NOT NULL,
  categorie depense_categorie NOT NULL DEFAULT 'AUTRE',
  objet text NOT NULL,
  statut depense_statut NOT NULL DEFAULT 'A_VALIDER',
  montant_ht numeric(12, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(4, 2) NOT NULL DEFAULT 20,
  date_echeance date,
  date_paiement timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_depenses_licence_id ON depenses(licence_id);
