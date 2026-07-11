-- Comptabilite core : plan comptable BTP (referentiel partage) + ecritures
-- en partie double. Additif/idempotent.

CREATE TABLE IF NOT EXISTS plan_comptable (
  compte_num text PRIMARY KEY,
  libelle text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO plan_comptable (compte_num, libelle) VALUES
  ('401', 'Fournisseurs'),
  ('411', 'Clients'),
  ('44566', 'TVA deductible sur autres biens et services'),
  ('44571', 'TVA collectee'),
  ('4191', 'Acomptes recus sur commandes'),
  ('4871', 'Produits constates d''avance'),
  ('1687', 'Cautionnements verses (retenue de garantie)'),
  ('512', 'Banque'),
  ('604', 'Achats d''etudes et prestations de services (sous-traitance)'),
  ('606', 'Achats non stockes de matieres et fournitures'),
  ('706', 'Prestations de services / Travaux')
ON CONFLICT (compte_num) DO NOTHING;

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  journal_code text NOT NULL,
  ecriture_num integer NOT NULL,
  ecriture_date date NOT NULL DEFAULT CURRENT_DATE,
  compte_num text NOT NULL REFERENCES plan_comptable(compte_num),
  compte_lib text NOT NULL,
  piece_ref text NOT NULL,
  piece_date date NOT NULL DEFAULT CURRENT_DATE,
  ecriture_lib text NOT NULL,
  debit numeric(12, 2) NOT NULL DEFAULT 0,
  credit numeric(12, 2) NOT NULL DEFAULT 0,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_licence_id ON journal_entries(licence_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_compte_num ON journal_entries(compte_num);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);

ALTER TABLE depenses ADD COLUMN IF NOT EXISTS autoliquidation boolean NOT NULL DEFAULT false;
