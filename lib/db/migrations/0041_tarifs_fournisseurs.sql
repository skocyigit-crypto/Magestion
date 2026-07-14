-- Prix d'un article par fournisseur, pour comparer les fournisseurs sur un
-- meme article catalogue. Additif/idempotent.

CREATE TABLE IF NOT EXISTS tarifs_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  fournisseur_id uuid NOT NULL REFERENCES fournisseurs(id),
  article_id uuid NOT NULL REFERENCES articles(id),
  prix_unitaire_ht numeric(10, 2) NOT NULL,
  reference_fournisseur text,
  delai_livraison_jours integer,
  date_validite date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tarifs_fournisseurs_article_idx ON tarifs_fournisseurs (article_id);
CREATE INDEX IF NOT EXISTS tarifs_fournisseurs_fournisseur_idx ON tarifs_fournisseurs (fournisseur_id);
CREATE UNIQUE INDEX IF NOT EXISTS tarifs_fournisseurs_fournisseur_article_idx ON tarifs_fournisseurs (fournisseur_id, article_id);
