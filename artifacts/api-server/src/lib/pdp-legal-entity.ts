import { db, licencesTable } from "@magestion/db";
import { eq } from "drizzle-orm";

/**
 * Provisionne (une seule fois) la "Legal Entity" Storecove d'une licence et
 * persiste son id dans `licences.pdpLegalEntityId`. Idempotent : si l'id
 * existe deja en base, renvoye directement sans appel reseau.
 *
 * IMPORTANT : schema `POST /legal_entities` / `POST .../peppol_identifiers`
 * base sur la spec OpenAPI publique de Storecove — a revalider avec un
 * compte sandbox reel avant mise en production (voir avertissement dans
 * lib/pdp.ts).
 */
export async function ensureStorecoveLegalEntity(licenceId: string, apiKey: string): Promise<string> {
  const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId));
  if (!licence) throw new Error(`Licence ${licenceId} introuvable`);
  if (licence.pdpLegalEntityId) return licence.pdpLegalEntityId;

  const missing: string[] = [];
  if (!licence.nom) missing.push("nom");
  if (!licence.adresse) missing.push("adresse");
  if (!licence.ville) missing.push("ville");
  if (!licence.codePostal) missing.push("code postal");
  if (missing.length > 0) {
    throw new Error(
      `Impossible de provisionner la Legal Entity Storecove : champs manquants sur la licence (${missing.join(", ")}). ` +
      "Completer la fiche entreprise avant le premier envoi e-facture.",
    );
  }

  const headers = { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}` };
  const baseUrl = "https://api.storecove.com/api/v2";

  const createResp = await fetch(`${baseUrl}/legal_entities`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      party_name: licence.nom,
      line1: licence.adresse,
      city: licence.ville,
      zip: licence.codePostal,
      country: "FR",
      tax_registered: true,
      acts_as_sender: true,
      acts_as_receiver: true,
      public: true,
    }),
  });
  const createBody = await createResp.text();
  if (!createResp.ok) {
    throw new Error(`Storecove n'a pas pu creer la Legal Entity (HTTP ${createResp.status}).`);
  }
  const created = JSON.parse(createBody) as { id?: number | string };
  if (created.id === undefined || created.id === null) {
    throw new Error("Storecove n'a pas retourne d'id de Legal Entity.");
  }
  const legalEntityId = String(created.id);

  if (licence.siret) {
    const siret = licence.siret.replace(/\s+/g, "");
    await fetch(`${baseUrl}/legal_entities/${encodeURIComponent(legalEntityId)}/peppol_identifiers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ scheme: "0009", identifier: siret }),
    }).catch(() => undefined); // Non bloquant : la Legal Entity reste utilisable, l'enregistrement Peppol pourra etre retente.
  }

  await db.update(licencesTable).set({ pdpLegalEntityId: legalEntityId }).where(eq(licencesTable.id, licenceId));
  return legalEntityId;
}

/** Resout (et provisionne si besoin) l'id d'entite legale PDP de la licence. Renvoie null hors provider Storecove. */
export async function getLicencePdpLegalEntityId(licenceId: string): Promise<string | null> {
  const provider = process.env.PDP_PROVIDER?.trim().toLowerCase();
  if (provider !== "storecove") return null;
  const apiKey = process.env.PDP_API_KEY?.trim();
  if (!apiKey) throw new Error("PDP_PROVIDER=storecove requiert PDP_API_KEY.");
  return ensureStorecoveLegalEntity(licenceId, apiKey);
}
