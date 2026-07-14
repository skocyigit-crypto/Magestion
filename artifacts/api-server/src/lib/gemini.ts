// Appel REST direct (pas de SDK @google/genai) pour garder la dependance
// minimale — l'API Gemini generateContent est un simple POST JSON.
// Alias "latest" (pas de version figee) : evite la 404 "model no longer
// available to new users" quand Google retire une version specifique.
const MODEL = "gemini-flash-latest";

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GOOGLE_GEMINI_API_KEY non configuree — fonctionnalite IA indisponible");
    this.name = "GeminiNotConfiguredError";
  }
}

export async function extractJsonFromImage(imageBuffer: Buffer, mimeType: string, prompt: string): Promise<unknown> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API erreur ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Reponse Gemini vide ou inattendue");

  // Filet de securite : malgre responseMimeType=application/json, le modele
  // ajoute parfois des cloches markdown ou du texte avant/apres l'objet ->
  // on extrait la sous-chaine entre la premiere { et la derniere } plutot
  // que de parser le texte brut tel quel.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Reponse Gemini sans JSON exploitable : ${text.slice(0, 200)}`);
  }
  const cleaned = text.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`JSON Gemini invalide : ${cleaned.slice(0, 200)}`);
  }
}

const FACE_MATCH_PROMPT = `Tu compares une photo prise au moment du pointage (PREMIERE image) a une serie de
photos de reference d'employes (images suivantes, chacune precedee de son identifiant "Employe <id>:").
Determine si la premiere photo correspond a UN SEUL de ces employes de reference (meme personne).
Reponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{ "matched": true ou false, "employeeId": "id de l'employe correspondant ou null", "confidence": nombre 0-100 }
Sois strict : en cas de doute ou de plusieurs correspondances possibles, reponds matched=false. Ne devine jamais.`;

const FACE_MATCH_THRESHOLD = 60;

export async function matchFaceAgainstReferences(
  captured: { buffer: Buffer; mimeType: string },
  references: { employeeId: string; buffer: Buffer; mimeType: string }[],
): Promise<{ matched: boolean; employeeId: string | null; confidence: number }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: FACE_MATCH_PROMPT },
    { inlineData: { mimeType: captured.mimeType, data: captured.buffer.toString("base64") } },
  ];
  for (const ref of references) {
    parts.push({ text: `Employe ${ref.employeeId}:` });
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.buffer.toString("base64") } });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API erreur ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Reponse Gemini vide ou inattendue");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error(`Reponse Gemini sans JSON exploitable : ${text.slice(0, 200)}`);

  const raw = JSON.parse(text.slice(start, end + 1)) as { matched?: boolean; employeeId?: string | null; confidence?: number };
  const confidence = typeof raw.confidence === "number" ? raw.confidence : 0;
  // Le seuil est re-verifie ici, jamais confie tel quel a la reponse du modele
  // (meme principe que emissionsKgCo2/facteurEmission : une decision qui a des
  // consequences metier n'est jamais prise uniquement cote client/modele).
  if (!raw.matched || !raw.employeeId || confidence < FACE_MATCH_THRESHOLD) {
    return { matched: false, employeeId: null, confidence };
  }
  return { matched: true, employeeId: raw.employeeId, confidence };
}
