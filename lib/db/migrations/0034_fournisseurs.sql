-- Registre fournisseur centralise (materiaux/prestations), independant des
-- sous-traitants (main d'oeuvre). Additif/idempotent.

CREATE TABLE IF NOT EXISTS fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  nom text NOT NULL,
  email text,
  telephone text,
  adresse text,
  code_postal varchar(10),
  ville text,
  siret varchar(14),
  tva_intracommunautaire text,
  iban text,
  bic text,
  conditions_paiement text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fournisseurs_licence_idx ON fournisseurs (licence_id);

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS fournisseur_id uuid REFERENCES fournisseurs(id);
CREATE INDEX IF NOT EXISTS commandes_fournisseur_idx ON commandes (fournisseur_id);

ALTER TABLE depenses ADD COLUMN IF NOT EXISTS fournisseur_id uuid REFERENCES fournisseurs(id);
CREATE INDEX IF NOT EXISTS depenses_fournisseur_idx ON depenses (fournisseur_id);
