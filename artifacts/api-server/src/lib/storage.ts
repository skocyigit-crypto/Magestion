import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, createReadStream as fsCreateReadStream, unlinkSync as fsUnlinkSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { Response } from "express";
import { Storage } from "@google-cloud/storage";

// Chemin absolu (pas cwd-relatif — meme raison que PGLITE_DATA_DIR dans
// @magestion/db) : racine du package api-server, pas la racine du monorepo.
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR
  ? join(PACKAGE_ROOT, process.env.LOCAL_STORAGE_DIR)
  : join(PACKAGE_ROOT, "storage");

const useGcs = process.env.STORAGE_MODE === "gcs";

if (!useGcs) {
  mkdirSync(STORAGE_DIR, { recursive: true });
}

// Abstraction disque local (dev) / Google Cloud Storage (prod, voir
// STORAGE_MODE=gcs + GCS_BUCKET_NAME) — Cloud Run n'a pas de disque persistant
// entre redemarrages de conteneur, un fichier local serait perdu. Les deux
// implementations partagent le meme "chemin relatif" que documents.cheminFichier
// (<licenceId>/<nom-physique>) stocke en base, portable entre les deux modes.
export interface StorageAdapter {
  save(relativePath: string, buffer: Buffer): Promise<void>;
  readBuffer(relativePath: string): Promise<Buffer>;
  remove(relativePath: string): Promise<void>;
  sendFile(relativePath: string, res: Response, downloadName?: string): void;
}

const localAdapter: StorageAdapter = {
  async save(relativePath, buffer) {
    const fullPath = join(STORAGE_DIR, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
  },
  async readBuffer(relativePath) {
    return readFile(join(STORAGE_DIR, relativePath));
  },
  async remove(relativePath) {
    try {
      fsUnlinkSync(join(STORAGE_DIR, relativePath));
    } catch {
      // Fichier deja absent : rien a faire.
    }
  },
  sendFile(relativePath, res, downloadName) {
    if (downloadName) res.download(join(STORAGE_DIR, relativePath), downloadName);
    else res.sendFile(join(STORAGE_DIR, relativePath));
  },
};

// Client cree uniquement si STORAGE_MODE=gcs (Application Default Credentials
// automatiques sur Cloud Run via le compte de service attache — pas de cle a gerer).
const gcsBucket = useGcs
  ? new Storage().bucket(
      (() => {
        const name = process.env.GCS_BUCKET_NAME;
        if (!name) throw new Error("GCS_BUCKET_NAME requis quand STORAGE_MODE=gcs");
        return name;
      })(),
    )
  : null;

const gcsAdapter: StorageAdapter = {
  async save(relativePath, buffer) {
    await gcsBucket!.file(relativePath).save(buffer);
  },
  async readBuffer(relativePath) {
    const [buffer] = await gcsBucket!.file(relativePath).download();
    return buffer;
  },
  async remove(relativePath) {
    try {
      await gcsBucket!.file(relativePath).delete();
    } catch {
      // Fichier deja absent : rien a faire.
    }
  },
  sendFile(relativePath, res, downloadName) {
    if (downloadName) res.attachment(downloadName);
    const stream = gcsBucket!.file(relativePath).createReadStream();
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "Fichier introuvable" });
    });
    stream.pipe(res);
  },
};

export const storageAdapter: StorageAdapter = useGcs ? gcsAdapter : localAdapter;
