-- RGPD : journal d'acces/export/anonymisation des donnees personnelles
-- (employes, prospects) + consentement prospect. L'anonymisation remplace
-- le "droit a l'effacement" (incompatible avec la regle produit absolue de
-- non-suppression) par un scellement irreversible des champs identifiants.
-- Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE rgpd_action AS ENUM ('EXPORT', 'ANONYMISATION', 'CONSENTEMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rgpd_entity_type AS ENUM ('EMPLOYEE', 'PROSPECT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS journal_rgpd (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  action rgpd_action NOT NULL,
  entity_type rgpd_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  effectue_par uuid REFERENCES users(id),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_rgpd_licence_id ON journal_rgpd(licence_id);

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS consentement_rgpd boolean NOT NULL DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS consentement_date timestamptz;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS anonymise boolean NOT NULL DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS anonymise boolean NOT NULL DEFAULT false;
