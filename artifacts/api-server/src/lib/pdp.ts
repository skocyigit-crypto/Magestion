// Connecteur PDP (Plateforme de Dematerialisation Partenaire) / PPF —
// facturation electronique obligatoire B2B en France (2026).
//
// Si PDP_API_URL est definie (+ PDP_API_KEY, PDP_PLATFORM_ID), on transmet
// reellement a la plateforme. Sinon, on simule localement (aucun reseau) afin
// de debloquer le flux de bout en bout sans contrat PDP — le resultat est
// alors toujours etiquete simulation=true (UI + facture.eSimulation), jamais
// presente comme une transmission reelle.

export type PdpStatus = "deposee" | "recue_destinataire" | "acceptee" | "refusee" | "en_litige" | "encaissee";

export interface TransmitPayload {
  numero: string;
  xml: string;
  clientNom: string;
  montantTtc: number;
}

export interface TransmitResult {
  platformRef: string;
  status: PdpStatus;
  simulation: boolean;
}

export interface StatusResult {
  platformRef: string;
  status: PdpStatus;
  simulation: boolean;
}

export interface PdpConnector {
  readonly mode: "live" | "simulation";
  transmit(payload: TransmitPayload): Promise<TransmitResult>;
  getStatus(platformRef: string): Promise<StatusResult>;
}

const SIM_PREFIX = "SIM";

function makeSimRef(): string {
  return `${SIM_PREFIX}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function depositTimeFromRef(ref: string): number | null {
  const parts = ref.split("-");
  if (parts.length < 2 || parts[0] !== SIM_PREFIX) return null;
  const t = parseInt(parts[1], 36);
  return Number.isFinite(t) ? t : null;
}

// Progression deterministe (fondee sur l'horodatage encode dans la reference) :
// deposee -> recue_destinataire -> acceptee, pour donner un cycle de vie
// credible a l'ecran sans dependre d'un service externe.
function statusForElapsed(ms: number): PdpStatus {
  if (ms < 10_000) return "deposee";
  if (ms < 30_000) return "recue_destinataire";
  return "acceptee";
}

class SimulationPdpConnector implements PdpConnector {
  readonly mode = "simulation" as const;

  async transmit(_payload: TransmitPayload): Promise<TransmitResult> {
    return { platformRef: makeSimRef(), status: "deposee", simulation: true };
  }

  async getStatus(platformRef: string): Promise<StatusResult> {
    const deposit = depositTimeFromRef(platformRef);
    const status = deposit === null ? "acceptee" : statusForElapsed(Date.now() - deposit);
    return { platformRef, status, simulation: true };
  }
}

class HttpPdpConnector implements PdpConnector {
  readonly mode = "live" as const;

  constructor(private baseUrl: string, private apiKey: string | undefined, private platformId: string | undefined) {}

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...(this.platformId ? { "X-Platform-Id": this.platformId } : {}),
    };
  }

  async transmit(payload: TransmitPayload): Promise<TransmitResult> {
    const res = await fetch(`${this.baseUrl}/invoices`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`PDP: echec transmission (${res.status})`);
    const data = (await res.json()) as { platformRef: string; status: PdpStatus };
    return { platformRef: data.platformRef, status: data.status, simulation: false };
  }

  async getStatus(platformRef: string): Promise<StatusResult> {
    const res = await fetch(`${this.baseUrl}/invoices/${encodeURIComponent(platformRef)}/status`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`PDP: echec recuperation statut (${res.status})`);
    const data = (await res.json()) as { status: PdpStatus };
    return { platformRef, status: data.status, simulation: false };
  }
}

export function getPdpConnector(): PdpConnector {
  const baseUrl = process.env.PDP_API_URL?.trim();
  if (baseUrl) return new HttpPdpConnector(baseUrl, process.env.PDP_API_KEY?.trim(), process.env.PDP_PLATFORM_ID?.trim());
  return new SimulationPdpConnector();
}

export function libellePdpStatus(status: PdpStatus): string {
  const map: Record<PdpStatus, string> = {
    deposee: "Deposee sur la plateforme",
    recue_destinataire: "Mise a disposition du destinataire",
    acceptee: "Acceptee par le destinataire",
    refusee: "Refusee par le destinataire",
    en_litige: "En litige",
    encaissee: "Paiement signale",
  };
  return map[status] ?? status;
}
