-- Fondations : licences (tenants) + users. Additif/idempotent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE licence_plan AS ENUM ('TRIAL', 'STARTER', 'PME', 'ENTREPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE licence_status AS ENUM ('ACTIF', 'SUSPENDU', 'ARCHIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'COMMERCIAL', 'TERRAIN', 'COMPTABILITE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  siret varchar(14),
  plan licence_plan NOT NULL DEFAULT 'TRIAL',
  status licence_status NOT NULL DEFAULT 'ACTIF',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id uuid REFERENCES licences(id),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  nom text NOT NULL,
  role user_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_licence_id ON users(licence_id);
