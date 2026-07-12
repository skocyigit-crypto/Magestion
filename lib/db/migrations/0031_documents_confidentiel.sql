-- Zone Privee documents : tier de confidentialite reserve a SUPER_ADMIN/COMPTABILITE.
-- Additif/idempotent.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS confidentiel boolean NOT NULL DEFAULT false;
