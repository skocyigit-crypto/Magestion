import { getToken } from "@/lib/api";

export interface ExtractedDepense {
  fournisseur: string | null;
  objet: string | null;
  montantHt: number | null;
  tauxTva: number | null;
  dateEcheance: string | null;
}

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

export async function analyserFactureDepense(file: File): Promise<ExtractedDepense> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/ai-import/depense`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Erreur analyse IA" }));
    throw new Error(body.error ?? "Erreur analyse IA");
  }
  return res.json();
}
