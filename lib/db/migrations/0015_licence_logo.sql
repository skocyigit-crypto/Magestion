-- Logo de l'entreprise (en-tete PDF devis/factures). Additif/idempotent.

ALTER TABLE licences ADD COLUMN IF NOT EXISTS logo_chemin text;
