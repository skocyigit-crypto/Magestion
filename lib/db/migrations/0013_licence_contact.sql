-- Coordonnees societe (necessaires pour l'en-tete legal des PDF devis/factures
-- et le nom d'expediteur des emails). Additif/idempotent.

ALTER TABLE licences ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE licences ADD COLUMN IF NOT EXISTS code_postal varchar(10);
ALTER TABLE licences ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE licences ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE licences ADD COLUMN IF NOT EXISTS telephone varchar(30);
ALTER TABLE licences ADD COLUMN IF NOT EXISTS tva_intracommunautaire varchar(20);
