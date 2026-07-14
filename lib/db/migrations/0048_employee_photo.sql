-- Photo de reference employe + consentement explicite, prealables a la
-- reconnaissance faciale au pointage (voir routes/faceRecognition.ts).
-- Donnee biometrique : consentement stocke separement de la photo elle-meme,
-- jamais de defaut a true. Additif/idempotent.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS consentement_reconnaissance_faciale boolean NOT NULL DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url text;
