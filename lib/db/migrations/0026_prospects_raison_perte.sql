-- Analyse des motifs de perte prospect (statut PERDU) — obligatoire cote
-- application pour ameliorer le taux de conversion. Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE raison_perte AS ENUM ('PRIX', 'DELAI', 'CONCURRENT', 'SANS_SUITE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS raison_perte raison_perte;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS raison_perte_detail text;
