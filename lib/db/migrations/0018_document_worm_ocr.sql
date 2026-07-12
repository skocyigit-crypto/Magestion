-- GED avancee : verrouillage WORM (Write Once Read Many) + scellement
-- d'integrite (SHA-256) + tracabilite du classement automatique par IA.
-- Additif/idempotent.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS verrouille boolean NOT NULL DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verrouille_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verrouille_par uuid REFERENCES users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS hash_sha256 text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS classification_ia boolean NOT NULL DEFAULT false;
