import { apiFetch } from "@/lib/api";

export interface RetenueLiberation {
  id: string;
  projectId: string;
  montant: string;
  dateLiberation: string;
  notes: string | null;
  active: boolean;
}

export interface RetenueGarantieOverview {
  totalRetenue: number;
  totalLibere: number;
  resteALiberer: number;
  liberations: RetenueLiberation[];
}

export function getRetenueGarantie(projectId: string) {
  return apiFetch<RetenueGarantieOverview>(`/retenues-garantie/${projectId}`);
}

export function libererRetenue(projectId: string, input: { montant: number; dateLiberation: string; notes?: string }) {
  return apiFetch<RetenueLiberation>(`/retenues-garantie/${projectId}/liberer`, { method: "POST", body: JSON.stringify(input) });
}
