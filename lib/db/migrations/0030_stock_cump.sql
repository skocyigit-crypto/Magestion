-- Cout unitaire moyen pondere (CUMP) : conserve le prix de chaque lot entrant
-- pour permettre l'audit du recalcul de prix_unitaire_ht sur stock_items.
-- Additif/idempotent.

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS prix_unitaire_ht numeric(10, 2);
