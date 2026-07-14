import { apiFetch } from "@/lib/api";

export interface AgentMessage {
  role: "user" | "model";
  text: string;
}

export function runAgent(messages: AgentMessage[]) {
  return apiFetch<{ reply: string; toolCalls: number }>("/agent/run", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}
