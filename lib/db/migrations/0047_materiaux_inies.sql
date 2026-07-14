-- Bibliotheque de materiaux avec facteurs d'emission de reference (base
-- INIES/ADEME), utilisee pour pre-remplir les lignes de bilan carbone au
-- lieu d'une saisie 100% manuelle. Additif/idempotent.

CREATE TABLE IF NOT EXISTS materiaux_inies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  code_inies text,
  designation text NOT NULL,
  categorie text NOT NULL DEFAULT 'gros_oeuvre',
  sous_categorie text,
  unite_fonctionnelle text NOT NULL,
  emission_co2_kg numeric(12, 4) NOT NULL,
  source text NOT NULL DEFAULT 'INIES',
  duree_vie_ans integer,
  densite_kg_m3 numeric(10, 2),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS materiaux_inies_licence_idx ON materiaux_inies (licence_id);

-- Reference optionnelle : quel materiau de la bibliotheque a servi a
-- pre-remplir cette ligne (tracabilite). NULL = saisie libre, comme avant.
ALTER TABLE bilan_carbone ADD COLUMN IF NOT EXISTS materiau_inies_id uuid REFERENCES materiaux_inies(id);
