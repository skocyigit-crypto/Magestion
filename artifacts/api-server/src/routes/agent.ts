import { Router } from "express";
import { z } from "zod";
import { requireLicenceId } from "../lib/tenantScope.js";
import { requireModuleAccess } from "../lib/rbac.js";
import { runAgentTurn } from "../lib/geminiAgent.js";
import { GeminiNotConfiguredError } from "../lib/gemini.js";

export const agentRouter = Router();
agentRouter.use(requireModuleAccess("agent"));

// Stateless : le client renvoie tout l'historique a chaque appel (pas de
// session serveur) — meme logique que les autres endpoints IA de ce projet
// (aiImport.ts), coherent avec l'absence de stockage de conversation.
const runInputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
});

agentRouter.post("/run", async (req, res) => {
  const licenceId = requireLicenceId(req.user!, res);
  if (!licenceId) return;

  const parsed = runInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide", details: parsed.error.flatten() });
    return;
  }

  try {
    const { reply, toolCalls } = await runAgentTurn(parsed.data.messages, licenceId);
    res.json({ reply, toolCalls });
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error("[agent]", err);
    res.status(502).json({ error: "Erreur assistant IA, reessayez" });
  }
});
