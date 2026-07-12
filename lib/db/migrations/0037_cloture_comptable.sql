-- Checklist de cloture d'exercice comptable (auto-generee par exercice).
-- Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE etape_cloture_statut AS ENUM ('A_FAIRE', 'EN_COURS', 'FAIT', 'BLOQUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS etapes_cloture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  exercice varchar(4) NOT NULL,
  ordre integer NOT NULL,
  titre text NOT NULL,
  description text,
  obligatoire boolean NOT NULL DEFAULT true,
  statut etape_cloture_statut NOT NULL DEFAULT 'A_FAIRE',
  date_realisation timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS etapes_cloture_licence_exercice_idx ON etapes_cloture (licence_id, exercice);
