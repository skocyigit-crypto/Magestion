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
  clientSiret?: string | null;
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

/**
 * `legalEntityId` identifie l'entite legale de la licence chez la PDP (voir
 * `licences.pdpLegalEntityId`, provisionne par `ensureStorecoveLegalEntity`).
 * Optionnel : les connecteurs mono-entite (contrat PDP dedie a une seule
 * societe) ou le connecteur SIMULATION l'ignorent sans erreur.
 */
export interface PdpConnector {
  readonly mode: "live" | "simulation";
  transmit(payload: TransmitPayload, legalEntityId?: string | null): Promise<TransmitResult>;
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

  async transmit(_payload: TransmitPayload, _legalEntityId?: string | null): Promise<TransmitResult> {
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

  async transmit(payload: TransmitPayload, legalEntityId?: string | null): Promise<TransmitResult> {
    const res = await fetch(`${this.baseUrl}/invoices`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ ...payload, legalEntityId: legalEntityId ?? null }),
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

/**
 * Connecteur PDP reel pour Storecove (https://www.storecove.com), Plateforme
 * Agreee (ex-PDP) enregistree DGFiP, choisie pour son modele API-first
 * multi-tenant (une "Legal Entity" Storecove par licence — voir
 * `ensureStorecoveLegalEntity` — sous un seul contrat/compte Storecove).
 *
 * IMPORTANT — champs a confirmer avec un compte SANDBOX Storecove reel avant
 * mise en production : le schema exact de `POST /document_submissions`
 * (enveloppe document/documentType pour transmettre notre XML deja genere en
 * passthrough) et le vocabulaire de statut renvoye par
 * `GET /document_submissions/{guid}` n'ont pas pu etre valides par un appel
 * reel (documentation publique incomplete sur ces deux points). Les echecs
 * HTTP ne sont jamais masques : une enveloppe incorrecte remontera comme une
 * erreur explicite plutot que de faire croire a un envoi reussi.
 */
class StorecovePdpConnector implements PdpConnector {
  readonly mode = "live" as const;
  private readonly baseUrl = "https://api.storecove.com/api/v2";

  constructor(private apiKey: string) {}

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${this.apiKey}` };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, { ...init, headers: { ...this.headers(), ...(init?.headers || {}) } });
    const text = await res.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
    if (!res.ok) {
      const msg = (body && typeof body === "object" && "message" in body)
        ? String((body as Record<string, unknown>).message)
        : `HTTP ${res.status}`;
      throw new Error(`Erreur Storecove (${res.status}) : ${msg}`);
    }
    return body as T;
  }

  async transmit(payload: TransmitPayload, legalEntityId?: string | null): Promise<TransmitResult> {
    if (!legalEntityId) throw new Error("Legal Entity Storecove non provisionnee pour cette licence (voir ensureStorecoveLegalEntity).");
    if (!payload.clientSiret) throw new Error(`Client "${payload.clientNom}" sans SIRET — impossible de router via Storecove.`);

    const data = await this.request<{ guid?: string }>("/document_submissions", {
      method: "POST",
      body: JSON.stringify({
        legalEntityId,
        routing: { eIdentifiers: [{ scheme: "0009", identifier: payload.clientSiret.replace(/\s+/g, "") }] },
        documentType: "invoice",
        document: Buffer.from(payload.xml, "utf-8").toString("base64"),
      }),
    });
    if (!data.guid) throw new Error("Storecove n'a pas retourne de GUID de soumission.");
    return { platformRef: data.guid, status: "deposee", simulation: false };
  }

  async getStatus(platformRef: string): Promise<StatusResult> {
    const data = await this.request<{ status?: string; errors?: Array<{ message?: string }> }>(
      `/document_submissions/${encodeURIComponent(platformRef)}`,
    );
    if (data.errors && data.errors.length > 0) {
      return { platformRef, status: "refusee", simulation: false };
    }
    return { platformRef, status: "recue_destinataire", simulation: false };
  }
}

/**
 * Fabrique du connecteur PDP.
 *
 * - `PDP_PROVIDER=storecove` (+ `PDP_API_KEY`) : connecteur Storecove reel
 *   (Plateforme Agreee DGFiP, multi-tenant via Legal Entity par licence).
 * - `PDP_API_URL` (sans `PDP_PROVIDER`) : connecteur HTTP generique
 *   conventionnel, pour toute autre PDP.
 * - Sinon : SIMULATION.
 */
export function getPdpConnector(): PdpConnector {
  const provider = process.env.PDP_PROVIDER?.trim().toLowerCase();
  if (provider === "storecove") {
    const apiKey = process.env.PDP_API_KEY?.trim();
    if (!apiKey) throw new Error("PDP_PROVIDER=storecove requiert PDP_API_KEY.");
    return new StorecovePdpConnector(apiKey);
  }
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
