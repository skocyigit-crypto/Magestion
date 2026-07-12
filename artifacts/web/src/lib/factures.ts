import { apiFetch, downloadFile } from "@/lib/api";
import type { Ligne, LigneInput } from "@/lib/devis";

export type FactureStatut = "BROUILLON" | "ENVOYEE" | "PAYEE" | "EN_RETARD";

export type FactureEStatut = "deposee" | "recue_destinataire" | "acceptee" | "refusee" | "en_litige" | "encaissee";

export interface Facture {
  id: string;
  projectId: string | null;
  devisId: string | null;
  numero: string;
  client: string;
  clientEmail: string | null;
  clientAdresse: string | null;
  clientCodePostal: string | null;
  clientVille: string | null;
  clientSiret: string | null;
  clientPays: string | null;
  objet: string;
  statut: FactureStatut;
  montantHt: string;
  tauxTva: string;
  dateEcheance: string | null;
  datePaiement: string | null;
  eStatut: FactureEStatut | null;
  ePlatformRef: string | null;
  eSimulation: boolean | null;
  eTransmisAt: string | null;
  eErreur: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const FACTURE_E_STATUT_LABELS: Record<FactureEStatut, string> = {
  deposee: "Deposee sur la plateforme",
  recue_destinataire: "Mise a disposition du destinataire",
  acceptee: "Acceptee par le destinataire",
  refusee: "Refusee par le destinataire",
  en_litige: "En litige",
  encaissee: "Paiement signale",
};

export interface FactureStatutChangeResult extends Facture {
  emailSent?: boolean;
  emailError?: string;
}

export function listFactures() {
  return apiFetch<Facture[]>("/factures");
}

export function getFacture(id: string) {
  return apiFetch<Facture>(`/factures/${id}`);
}

export function changeFactureStatut(id: string, statut: "ENVOYEE" | "PAYEE" | "EN_RETARD") {
  return apiFetch<FactureStatutChangeResult>(`/factures/${id}/statut`, { method: "POST", body: JSON.stringify({ statut }) });
}

export interface FactureUpdateInput {
  objet?: string;
  clientEmail?: string;
  clientAdresse?: string;
  clientCodePostal?: string;
  clientVille?: string;
  clientSiret?: string;
  clientPays?: string;
  montantHt?: number;
  tauxTva?: 0 | 5.5 | 10 | 20;
  dateEcheance?: string;
}

// Le backend renvoie 423 si la facture n'est plus BROUILLON (immutabilite post-emission).
export function updateFacture(id: string, input: FactureUpdateInput) {
  return apiFetch<Facture>(`/factures/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function downloadFacturePdf(id: string, numero: string) {
  return downloadFile(`/factures/${id}/pdf`, `facture-${numero}.pdf`);
}

export function listFactureLignes(id: string) {
  return apiFetch<Ligne[]>(`/factures/${id}/lignes`);
}

// Remplace l'integralite des lignes — refuse (423) une fois la facture hors BROUILLON.
export function saveFactureLignes(id: string, lignes: LigneInput[]) {
  return apiFetch<{ facture: Facture; lignes: Ligne[] }>(`/factures/${id}/lignes`, { method: "PUT", body: JSON.stringify({ lignes }) });
}

export function downloadFacturxXml(id: string, numero: string) {
  return downloadFile(`/factures/${id}/facturx-xml`, `facturx-${numero}.xml`);
}

export function transmettrePdp(id: string) {
  return apiFetch<Facture>(`/factures/${id}/transmettre-pdp`, { method: "POST" });
}

export function rafraichirStatutPdp(id: string) {
  return apiFetch<Facture>(`/factures/${id}/statut-pdp`);
}

export const FACTURE_STATUT_LABELS: Record<FactureStatut, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyee",
  PAYEE: "Payee",
  EN_RETARD: "En retard",
};
