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
