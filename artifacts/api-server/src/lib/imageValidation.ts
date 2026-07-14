// Le mimetype declare par le client (header multipart) est trivialement
// falsifiable — on verifie les "magic bytes" reels du fichier pour confirmer
// que le contenu correspond vraiment au type annonce avant de le stocker.
// Extrait de routes/parametres.ts (logo entreprise) lors de l'ajout de la
// photo de reference employe (routes/employees.ts) : meme validation, deux
// consommateurs — centralise plutot que duplique une deuxieme fois.
export const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const IMAGE_EXT_TO_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export function detectImageExt(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}
