import { AGENT_TOOL_DECLARATIONS, callAgentTool } from "./aiAgentTools.js";
import { GeminiNotConfiguredError } from "./gemini.js";

// Alias "latest" comme lib/gemini.ts — evite la 404 quand Google retire une
// version specifique. gemini-flash-latest supporte le function calling.
const MODEL = "gemini-flash-latest";
const MAX_TOOL_ITERATIONS = 6;

export type AgentMessage = { role: "user" | "model"; text: string };

type GeminiPart = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } };
type GeminiContent = { role: "user" | "model" | "function"; parts: GeminiPart[] };

const SYSTEM_PROMPT = `Tu es l'assistant integre de Magestion, un logiciel de gestion BTP francais.
Tu aides l'utilisateur a consulter les donnees de son entreprise (chantiers, clients, prospects, devis,
factures, fournisseurs, employes, stock, articles, agenda) via les outils fournis.
Regles strictes :
- Tu ne peux QUE lire des donnees via les outils, jamais en creer/modifier/supprimer — si on te le demande,
  explique que l'utilisateur doit passer par l'ecran correspondant de l'application.
- Ne jamais inventer de chiffres : si un outil ne renvoie pas l'information, dis-le explicitement.
- Reponds en francais, de facon concise et actionnable (chiffres cles, pas de remplissage).
- N'utilise AUCUNE syntaxe Markdown (pas de **gras**, pas de listes a puce "-"/"*", pas de titres #) —
  le chat affiche du texte brut. Utilise des retours a la ligne et une numerotation simple ("1.", "2.") si besoin.`;

export async function runAgentTurn(history: AgentMessage[], licenceId: string): Promise<{ reply: string; toolCalls: number }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const contents: GeminiContent[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  let toolCalls = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini API erreur ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { candidates?: { content?: GeminiContent }[] };
    const modelContent = data.candidates?.[0]?.content;
    if (!modelContent) throw new Error("Reponse Gemini vide ou inattendue");

    const functionCalls = modelContent.parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (functionCalls.length === 0) {
      const text = modelContent.parts.map((p) => p.text ?? "").join("").trim();
      return { reply: text || "(reponse vide)", toolCalls };
    }

    // Le tour du modele (avec ses functionCall) doit etre rejoue dans
    // l'historique avant la reponse des outils, sinon Gemini rejette la
    // requete suivante (contexte incoherent).
    contents.push({ role: "model", parts: modelContent.parts });

    const responseParts: GeminiPart[] = [];
    for (const call of functionCalls) {
      toolCalls++;
      const result = await callAgentTool(call.name, call.args ?? {}, licenceId);
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    contents.push({ role: "function", parts: responseParts });
  }

  throw new Error("Nombre maximum d'appels a des outils atteint sans reponse finale");
}
