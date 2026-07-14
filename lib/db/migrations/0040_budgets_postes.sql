-- Budgets analytiques par compte comptable, par exercice. Distinct du budget
-- par chantier deja existant (projects.budget_estime_ht). Additif/idempotent.

CREATE TABLE IF NOT EXISTS budgets_postes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  compte_num text NOT NULL REFERENCES plan_comptable(compte_num),
  exercice integer NOT NULL,
  montant_budgete_ht numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budgets_postes_licence_idx ON budgets_postes (licence_id);
CREATE UNIQUE INDEX IF NOT EXISTS budgets_postes_licence_compte_exercice_idx ON budgets_postes (licence_id, compte_num, exercice);
