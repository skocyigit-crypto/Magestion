-- Etend les relances aux factures impayees (jusqu'ici seuls les devis sans
-- reponse etaient couverts) — 3 paliers d'escalade (rappel/relance ferme/
-- mise en demeure), calcules a la volee depuis factures.date_echeance,
-- comme les paliers devis. Additif/idempotent.

ALTER TABLE relances ALTER COLUMN devis_id DROP NOT NULL;
ALTER TABLE relances ADD COLUMN IF NOT EXISTS facture_id uuid REFERENCES factures(id);
ALTER TABLE relances ADD COLUMN IF NOT EXISTS niveau text;
