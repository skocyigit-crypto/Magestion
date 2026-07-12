import { apiFetch } from "@/lib/api";

export interface AnalyticsCommercial {
  prospects: {
    total: number;
    parStatut: Record<string, number>;
    tauxConversionPercent: number | null;
    scoreMoyen: number;
    dureeMoyenneCycleJours: number | null;
  };
  devis: {
    total: number;
    parStatut: Record<string, number>;
    tauxTransformationPercent: number | null;
    montantMoyenHt: number;
    delaiMoyenReponseJours: number | null;
  };
}

export function getAnalyticsCommercial() {
  return apiFetch<AnalyticsCommercial>("/analytics-commercial");
}
