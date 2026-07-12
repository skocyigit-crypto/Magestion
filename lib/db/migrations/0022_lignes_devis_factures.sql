-- Lignes de devis/facture (designation/quantite/unite/prix/remise). Le
-- montant_ht du document parent devient une valeur calculee (somme des
-- lignes) des qu'il a au moins une ligne — voir routes/devis.ts,
-- routes/factures.ts. Additif/idempotent, ne casse pas les documents
-- existants (sans lignes, montant_ht reste tel quel).

CREATE TABLE IF NOT EXISTS devis_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES devis(id),
  ordre integer NOT NULL DEFAULT 0,
  designation text NOT NULL,
  quantite numeric(10, 2) NOT NULL DEFAULT 1,
  unite text NOT NULL DEFAULT 'u',
  prix_unitaire_ht numeric(12, 2) NOT NULL DEFAULT 0,
  remise_percent numeric(5, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis_id ON devis_lignes(devis_id);

CREATE TABLE IF NOT EXISTS facture_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id),
  ordre integer NOT NULL DEFAULT 0,
  designation text NOT NULL,
  quantite numeric(10, 2) NOT NULL DEFAULT 1,
  unite text NOT NULL DEFAULT 'u',
  prix_unitaire_ht numeric(12, 2) NOT NULL DEFAULT 0,
  remise_percent numeric(5, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture_id ON facture_lignes(facture_id);
