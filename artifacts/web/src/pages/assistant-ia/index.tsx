import { useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { runAgent, type AgentMessage } from "@/lib/agent";

const SUGGESTIONS = [
  "Combien de chantiers sont en cours ?",
  "Liste les factures en retard",
  "Quels devis sont en attente de reponse ?",
  "Quels articles de stock sont sous le seuil d'alerte ?",
];

export default function AssistantIaPage() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setError(null);
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { reply } = await runAgent(next);
      setMessages([...next, { role: "model", text: reply }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur assistant IA");
    } finally {
      setSending(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-6 py-8">
        <h1 className="mb-1 text-2xl font-semibold">Assistant IA</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Consulte vos donnees (chantiers, devis, factures, stock...) en langage naturel — lecture seule, aucune
          modification n'est possible depuis ce chat.
        </p>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border p-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Exemples de questions :</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="w-fit rounded-md border border-border px-3 py-1.5 text-left text-sm hover:bg-muted/30"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-orange-500 text-white" : "border border-border bg-muted/20"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && <p className="text-sm text-muted-foreground">L'assistant reflechit...</p>}
          {error && <p className="rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            className="h-10 flex-1 rounded-md border border-border bg-transparent px-3 text-sm"
            placeholder="Posez une question sur votre activite..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()}>Envoyer</Button>
        </form>
      </div>
    </Layout>
  );
}
