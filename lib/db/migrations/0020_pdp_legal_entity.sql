-- Identifiant de la "Legal Entity" chez le fournisseur PDP (Storecove), une
-- par licence (compte PDP unique partage entre toutes les licences).
ALTER TABLE licences ADD COLUMN IF NOT EXISTS pdp_legal_entity_id text;
