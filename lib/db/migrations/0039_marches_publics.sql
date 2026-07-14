-- Module Marches Publics : veille/appel d'offres -> marche notifie -> lots ->
-- execution (OS, PV reception, DGD, garanties, sous-traitance, avenants) ->
-- DOE + archives decennales. Reutilise clients/projects/devis/sous_traitants/
-- documents existants plutot que de dupliquer ces registres.
-- Additif/idempotent.

-- === Marches publics ===
DO $$ BEGIN
  CREATE TYPE marche_type AS ENUM ('TRAVAUX', 'SERVICES', 'FOURNITURES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marche_statut AS ENUM ('EN_COURS', 'TERMINE', 'RESILIE', 'SUSPENDU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS marches_publics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  numero text NOT NULL,
  intitule text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id),
  project_id uuid REFERENCES projects(id),
  devis_id uuid REFERENCES devis(id),
  type_marche marche_type NOT NULL DEFAULT 'TRAVAUX',
  procedure_type text NOT NULL DEFAULT 'MAPA',
  montant_initial_ht numeric(14, 2) NOT NULL DEFAULT 0,
  montant_actuel_ht numeric(14, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(5, 2) NOT NULL DEFAULT 20,
  date_notification timestamptz,
  date_debut_travaux timestamptz,
  date_fin_prevue timestamptz,
  date_reception timestamptz,
  delai_execution_mois integer,
  clause_revision_prix boolean NOT NULL DEFAULT false,
  indice_reference text,
  valeur_indice_mois_zero numeric(10, 4),
  part_fixe_pourcent numeric(5, 2) DEFAULT 15,
  caution_definitive_pourcent numeric(5, 2) DEFAULT 5,
  retenue_garantie_pourcent numeric(5, 2) DEFAULT 5,
  delai_garantie_mois integer DEFAULT 12,
  penalites_retard_jour numeric(10, 2),
  plafond_penalites_pourcent numeric(5, 2) DEFAULT 5,
  statut marche_statut NOT NULL DEFAULT 'EN_COURS',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marches_publics_licence_idx ON marches_publics (licence_id);
CREATE INDEX IF NOT EXISTS marches_publics_client_idx ON marches_publics (client_id);
CREATE INDEX IF NOT EXISTS marches_publics_project_idx ON marches_publics (project_id);
-- Numerotation legale sans doublon (cf. lib/numbering.ts withNumero : retry sur 23505).
CREATE UNIQUE INDEX IF NOT EXISTS marches_publics_licence_numero_idx ON marches_publics (licence_id, numero);

-- === Avenants ===
DO $$ BEGIN
  CREATE TYPE avenant_type AS ENUM ('REVISION_PRIX', 'TRAVAUX_SUPPLEMENTAIRES', 'PROLONGATION_DELAI', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE avenant_statut AS ENUM ('BROUILLON', 'SIGNE', 'TRANSMIS', 'IMPUTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS avenants_marche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  marche_id uuid NOT NULL REFERENCES marches_publics(id),
  numero integer NOT NULL,
  type_avenant avenant_type NOT NULL DEFAULT 'AUTRE',
  objet text NOT NULL,
  montant_ht numeric(14, 2) NOT NULL DEFAULT 0,
  indice_base numeric(10, 4),
  indice_actuel numeric(10, 4),
  coefficient_revision numeric(10, 6),
  date_signature timestamptz,
  statut avenant_statut NOT NULL DEFAULT 'BROUILLON',
  mode_transmission text,
  date_transmission timestamptz,
  date_imputation timestamptz,
  justification text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avenants_marche_marche_idx ON avenants_marche (marche_id);
CREATE UNIQUE INDEX IF NOT EXISTS avenants_marche_marche_numero_idx ON avenants_marche (marche_id, numero);

-- === Appels d'offres / candidatures (pipeline unifie) ===
DO $$ BEGIN
  CREATE TYPE procedure_type AS ENUM ('MAPA', 'AOO', 'AOR', 'DIALOGUE_COMPETITIF', 'NEGOCIEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appel_offre_statut AS ENUM ('VEILLE', 'EN_PREPARATION', 'DEPOSE', 'RETENU', 'REJETE', 'GAGNE', 'PERDU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS appels_offres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  reference text,
  intitule text NOT NULL,
  organisme text,
  client_id uuid REFERENCES clients(id),
  type_procedure procedure_type NOT NULL DEFAULT 'MAPA',
  date_publication date,
  date_limite_depot timestamptz,
  lieu text,
  categorie text,
  montant_estime_ht numeric(14, 2),
  montant_offre_ht numeric(14, 2),
  delai_propose_jours integer,
  statut appel_offre_statut NOT NULL DEFAULT 'VEILLE',
  motif_rejet text,
  marche_id uuid REFERENCES marches_publics(id),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appels_offres_licence_idx ON appels_offres (licence_id);
CREATE INDEX IF NOT EXISTS appels_offres_statut_idx ON appels_offres (statut);

-- === Lots (allotissement CCP art. L.2113-10) ===
DO $$ BEGIN
  CREATE TYPE lot_marche_statut AS ENUM ('A_ATTRIBUER', 'ATTRIBUE', 'INFRUCTUEUX', 'TERMINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS lots_marche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  marche_id uuid NOT NULL REFERENCES marches_publics(id),
  numero_lot text NOT NULL,
  intitule text NOT NULL,
  corps_metier text,
  montant_estime_ht numeric(14, 2) NOT NULL DEFAULT 0,
  montant_attribue_ht numeric(14, 2) DEFAULT 0,
  attributaire_client_id uuid REFERENCES clients(id),
  statut lot_marche_statut NOT NULL DEFAULT 'A_ATTRIBUER',
  date_attribution timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lots_marche_marche_idx ON lots_marche (marche_id);

-- === Execution : ordres de service ===
DO $$ BEGIN
  CREATE TYPE os_statut AS ENUM ('NOTIFIE', 'EXECUTE', 'REFUSE', 'RESERVES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS os_marche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  marche_id uuid NOT NULL REFERENCES marches_publics(id),
  lot_id uuid REFERENCES lots_marche(id),
  numero integer NOT NULL,
  date_os timestamptz NOT NULL,
  objet text NOT NULL,
  prescription text NOT NULL,
  delai_execution text,
  incidence_financiere_ht numeric(14, 2),
  statut os_statut NOT NULL DEFAULT 'NOTIFIE',
  reserves text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_marche_marche_idx ON os_marche (marche_id);
CREATE UNIQUE INDEX IF NOT EXISTS os_marche_marche_numero_idx ON os_marche (marche_id, numero);

-- === Execution : proces-verbaux de reception ===
DO $$ BEGIN
  CREATE TYPE type_pv AS ENUM ('OPR', 'RECEPTION', 'RECEPTION_AVEC_RESERVES', 'LEVEE_RESERVES', 'REFUS_RECEPTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS pv_reception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  marche_id uuid NOT NULL REFERENCES marches_publics(id),
  lot_id uuid REFERENCES lots_marche(id),
  type_pv type_pv NOT NULL,
  numero integer NOT NULL DEFAULT 1,
  date_pv timestamptz NOT NULL,
  date_effet_reception timestamptz,
  reserves text,
  observations text,
  declenche_garanties boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pv_reception_marche_idx ON pv_reception (marche_id);

-- === Execution : Decompte General Definitif ===
DO $$ BEGIN
  CREATE TYPE dgd_statut AS ENUM ('BROUILLON', 'ETABLI', 'NOTIFIE', 'ACCEPTE', 'CONTESTE', 'DEFINITIF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS dgd_marche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  marche_id uuid NOT NULL REFERENCES marches_publics(id),
  lot_id uuid REFERENCES lots_marche(id),
  numero integer NOT NULL DEFAULT 1,
  date_etablissement timestamptz NOT NULL,
  date_notification timestamptz,
  date_acceptation timestamptz,
  montant_initial_ht numeric(14, 2) NOT NULL DEFAULT 0,
  montant_avenants_ht numeric(14, 2) NOT NULL DEFAULT 0,
  montant_revision_ht numeric(14, 2) NOT NULL DEFAULT 0,
  penalites_ht numeric(14, 2) NOT NULL DEFAULT 0,
  primes_ht numeric(14, 2) NOT NULL DEFAULT 0,
  retenue_garantie_ht numeric(14, 2) NOT NULL DEFAULT 0,
  total_dgd_ht numeric(14, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(5, 2) NOT NULL DEFAULT 20,
  total_dgd_ttc numeric(14, 2) NOT NULL DEFAULT 0,
  acomptes_percus numeric(14, 2) NOT NULL DEFAULT 0,
  solde_a_regler numeric(14, 2) NOT NULL DEFAULT 0,
  reserves_acceptation text,
  statut dgd_statut NOT NULL DEFAULT 'BROUILLON',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dgd_marche_marche_idx ON dgd_marche (marche_id);

-- === Execution : garanties ===
DO $$ BEGIN
  CREATE TYPE type_garantie AS ENUM ('GPA', 'BIENNALE', 'DECENNALE', 'CAUTION_DEFINITIVE', 'RETENUE_GARANTIE', 'CAUTION_AVANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE garantie_statut AS ENUM ('ACTIVE', 'LEVEE', 'EXPIREE', 'MISE_EN_JEU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS garanties_marche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  marche_id uuid NOT NULL REFERENCES marches_publics(id),
  lot_id uuid REFERENCES lots_marche(id),
  type_garantie type_garantie NOT NULL,
  emetteur text,
  numero_acte text,
  montant_ht numeric(14, 2),
  pourcentage numeric(5, 2),
  date_debut timestamptz,
  date_fin timestamptz,
  date_levee timestamptz,
  statut garantie_statut NOT NULL DEFAULT 'ACTIVE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS garanties_marche_marche_idx ON garanties_marche (marche_id);
CREATE INDEX IF NOT EXISTS garanties_marche_alertes_idx ON garanties_marche (statut, date_fin);

-- === Execution : sous-traitance sur marche (DC4) ===
DO $$ BEGIN
  CREATE TYPE sous_traitant_marche_statut AS ENUM ('PROPOSE', 'ACCEPTE_MOA', 'REFUSE', 'ACTIF', 'TERMINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS marche_sous_traitants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  marche_id uuid NOT NULL REFERENCES marches_publics(id),
  lot_id uuid REFERENCES lots_marche(id),
  sous_traitant_id uuid NOT NULL REFERENCES sous_traitants(id),
  nature_travaux text NOT NULL,
  montant_sous_traite_ht numeric(14, 2) NOT NULL DEFAULT 0,
  paiement_direct boolean NOT NULL DEFAULT true,
  date_dc4 timestamptz,
  date_agrement timestamptz,
  date_notification timestamptz,
  statut sous_traitant_marche_statut NOT NULL DEFAULT 'PROPOSE',
  motif_refus text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marche_sous_traitants_marche_idx ON marche_sous_traitants (marche_id);

-- === DOE (Dossier des Ouvrages Executes) ===
DO $$ BEGIN
  CREATE TYPE doe_statut AS ENUM ('FINALISE', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS doe_marche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  marche_id uuid NOT NULL REFERENCES marches_publics(id),
  version integer NOT NULL DEFAULT 1,
  statut doe_statut NOT NULL DEFAULT 'FINALISE',
  document_id uuid REFERENCES documents(id),
  sections_snapshot jsonb DEFAULT '[]',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doe_marche_marche_idx ON doe_marche (marche_id);
CREATE UNIQUE INDEX IF NOT EXISTS doe_marche_marche_version_idx ON doe_marche (marche_id, version);

-- === Archives decennales ===
CREATE TABLE IF NOT EXISTS archives_decennales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  sous_traitant_id uuid NOT NULL REFERENCES sous_traitants(id),
  numero_attestation text NOT NULL,
  assureur text NOT NULL,
  activite_couverte text,
  date_debut_validite date NOT NULL,
  date_fin_validite date NOT NULL,
  document_id uuid REFERENCES documents(id),
  date_droc date,
  date_cloture date,
  scelle boolean NOT NULL DEFAULT false,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS archives_decennales_project_idx ON archives_decennales (project_id);
CREATE INDEX IF NOT EXISTS archives_decennales_sous_traitant_idx ON archives_decennales (sous_traitant_id);

-- === Indices BT/TP (revision de prix) ===
CREATE TABLE IF NOT EXISTS indices_bt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  code text NOT NULL,
  libelle text NOT NULL,
  periode text NOT NULL,
  valeur numeric(10, 4) NOT NULL,
  date_publication date,
  source text DEFAULT 'INSEE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS indices_bt_licence_idx ON indices_bt (licence_id);
CREATE INDEX IF NOT EXISTS indices_bt_code_periode_idx ON indices_bt (code, periode);

-- === Extension du GED generique pour rattacher pieces DCE / DOE / garanties ===
ALTER TYPE document_entity_type ADD VALUE IF NOT EXISTS 'APPEL_OFFRE';
ALTER TYPE document_entity_type ADD VALUE IF NOT EXISTS 'MARCHE_PUBLIC';
