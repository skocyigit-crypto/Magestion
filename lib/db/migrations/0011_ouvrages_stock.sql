-- Phase 4 : Ouvrages/Articles, Stock, Documents, Vehicules. Additif/idempotent.

DO $$ BEGIN
  CREATE TYPE article_categorie AS ENUM ('FOURNITURE', 'MAIN_OEUVRE', 'MATERIEL', 'SOUS_TRAITANCE', 'DIVERS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  code text NOT NULL,
  libelle text NOT NULL,
  unite text NOT NULL DEFAULT 'u',
  categorie article_categorie NOT NULL DEFAULT 'DIVERS',
  prix_unitaire_ht numeric(10, 2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_articles_licence_id ON articles(licence_id);

CREATE TABLE IF NOT EXISTS ouvrages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  code text NOT NULL,
  libelle text NOT NULL,
  unite text NOT NULL DEFAULT 'u',
  coefficient_k numeric(4, 2) NOT NULL DEFAULT 1.30,
  debourse_sec_ht numeric(10, 2) NOT NULL DEFAULT 0,
  prix_vente_ht numeric(10, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(4, 2) NOT NULL DEFAULT 20,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ouvrages_licence_id ON ouvrages(licence_id);

CREATE TABLE IF NOT EXISTS ouvrage_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ouvrage_id uuid NOT NULL REFERENCES ouvrages(id),
  article_id uuid NOT NULL REFERENCES articles(id),
  quantite numeric(10, 3) NOT NULL,
  ordre integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ouvrage_articles_ouvrage_id ON ouvrage_articles(ouvrage_id);

DO $$ BEGIN
  CREATE TYPE mouvement_type AS ENUM ('ENTREE', 'SORTIE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  nom text NOT NULL,
  categorie text,
  unite text NOT NULL DEFAULT 'u',
  quantite_actuelle numeric(10, 2) NOT NULL DEFAULT 0,
  seuil_alerte numeric(10, 2) NOT NULL DEFAULT 0,
  prix_unitaire_ht numeric(10, 2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_items_licence_id ON stock_items(licence_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  stock_item_id uuid NOT NULL REFERENCES stock_items(id),
  project_id uuid REFERENCES projects(id),
  type mouvement_type NOT NULL,
  quantite numeric(10, 2) NOT NULL,
  motif text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_licence_id ON stock_movements(licence_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_item_id ON stock_movements(stock_item_id);

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('CONTRAT', 'ASSURANCE', 'PERMIS', 'FACTURE', 'PLAN', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_entity_type AS ENUM ('PROJECT', 'EMPLOYEE', 'VEHICLE', 'SOUS_TRAITANT', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  nom text NOT NULL,
  type document_type NOT NULL DEFAULT 'AUTRE',
  entity_type document_entity_type NOT NULL DEFAULT 'GENERAL',
  entity_id uuid,
  chemin_fichier text NOT NULL,
  taille_octets integer NOT NULL DEFAULT 0,
  mime_type text,
  date_expiration date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_licence_id ON documents(licence_id);

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('CAMION', 'CAMIONNETTE', 'FOURGON', 'VOITURE', 'ENGIN_CHANTIER', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_carburant AS ENUM ('DIESEL', 'ESSENCE', 'ELECTRIQUE', 'GPL', 'HYBRIDE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_statut AS ENUM ('DISPONIBLE', 'EN_MISSION', 'EN_MAINTENANCE', 'HORS_SERVICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid NOT NULL REFERENCES licences(id),
  immatriculation varchar(20) NOT NULL,
  marque text,
  modele text,
  type vehicle_type NOT NULL DEFAULT 'AUTRE',
  carburant vehicle_carburant NOT NULL DEFAULT 'DIESEL',
  statut vehicle_statut NOT NULL DEFAULT 'DISPONIBLE',
  kilometrage integer NOT NULL DEFAULT 0,
  date_assurance_validite date,
  date_controle_technique_validite date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_licence_id ON vehicles(licence_id);
