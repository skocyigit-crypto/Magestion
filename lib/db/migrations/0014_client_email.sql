-- Email du client sur devis/factures : necessaire pour l'envoi reel d'emails
-- (devis "Envoyer", relances). Additif/idempotent.

ALTER TABLE devis ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_email text;
