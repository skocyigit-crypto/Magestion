-- Lettrage comptable (rapprochement de deux ecritures qui se soldent sur un
-- meme compte, ex: facture 411 debit + reglement 411 credit). Additif/idempotent.

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS ecriture_let text;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS date_let date;
CREATE INDEX IF NOT EXISTS idx_journal_entries_compte_let ON journal_entries(licence_id, compte_num, ecriture_let);
