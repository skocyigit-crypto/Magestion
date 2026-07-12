-- Facturation electronique 2026 (Factur-X + PDP/PPF). Additif/idempotent.
-- Champs adresse acheteur : necessaires pour un XML Factur-X valide
-- (BT-44/50/52/53 obligatoires) — absents jusqu'ici car "client" n'etait
-- qu'un texte libre. Optionnels en base : sans eux, la transmission PDP est
-- refusee avec un message clair (voir lib/facturx-xml.ts), la facture reste
-- utilisable normalement (PDF/email) sans ces champs.
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_adresse text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_code_postal text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_ville text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_siret text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_pays text;

-- Suivi du cycle de vie PDP (Plateforme de Dematerialisation Partenaire).
-- e_statut est NULL tant que la facture n'a jamais ete transmise.
DO $$ BEGIN
  CREATE TYPE facture_e_statut AS ENUM ('deposee', 'recue_destinataire', 'acceptee', 'refusee', 'en_litige', 'encaissee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE factures ADD COLUMN IF NOT EXISTS e_statut facture_e_statut;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS e_platform_ref text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS e_simulation boolean;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS e_transmis_at timestamptz;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS e_erreur text;
