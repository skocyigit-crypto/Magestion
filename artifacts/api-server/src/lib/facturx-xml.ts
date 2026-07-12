// Generateur Factur-X (XML CII, profil EN16931) — norme UN/CEFACT Cross
// Industry Invoice, cf. https://fnfe-mpe.org/factur-x/factur-x_fr/
//
// Les factures Magestion n'ont qu'une seule ligne (montantHt + tauxTva
// globaux, pas d'itemisation) : le document genere une facture Factur-X a
// ligne unique (BG-25), ce qui reste pleinement conforme EN16931 — rien
// n'impose plusieurs lignes.

export interface FacturxParty {
  nom: string;
  siret?: string | null;
  tvaIntra?: string | null;
  adresse: string;
  codePostal: string;
  ville: string;
  pays?: string | null;
}

export interface FacturxLigne {
  designation: string;
  quantite: number;
  unite: string;
  prixUnitaireHt: number;
  montantHt: number;
}

export interface FacturxInvoiceInput {
  numero: string;
  dateEmission: Date | string;
  dateEcheance?: Date | string | null;
  objet: string;
  montantHt: number;
  tauxTva: number;
  vendeur: FacturxParty;
  acheteur: FacturxParty;
  // Si presentes, une ligne XML par element — toutes partagent tauxTva (une
  // seule ventilation de TVA, voir lib/db/src/schema/lignes.ts). Sans lignes
  // (documents anterieurs a leur ajout), une ligne unique = objet/montantHt.
  lignes?: FacturxLigne[];
}

function esc(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0.00";
  return round2(n).toFixed(2);
}

function toIsoCountryCode(input: string | null | undefined): string {
  const raw = (input ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : "FR";
}

function partyXml(tag: "SellerTradeParty" | "BuyerTradeParty", p: FacturxParty): string {
  return `      <ram:${tag}>
        <ram:Name>${esc(p.nom)}</ram:Name>${p.siret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0009">${esc(p.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ""}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(p.codePostal)}</ram:PostcodeCode>
          <ram:LineOne>${esc(p.adresse)}</ram:LineOne>
          <ram:CityName>${esc(p.ville)}</ram:CityName>
          <ram:CountryID>${esc(toIsoCountryCode(p.pays))}</ram:CountryID>
        </ram:PostalTradeAddress>${p.tvaIntra ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(p.tvaIntra)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ""}
      </ram:${tag}>`;
}

/** Genere le XML Factur-X (CII EN16931) pour une facture Magestion (ligne unique). */
export function generateFacturxXml(inv: FacturxInvoiceInput): string {
  const rate = Number(inv.tauxTva) || 0;
  const basis = round2(inv.montantHt);
  const taxAmount = round2(basis * rate / 100);
  const grandTotal = round2(basis + taxAmount);
  const category = rate === 0 ? "Z" : "S";

  const lignes: FacturxLigne[] = inv.lignes && inv.lignes.length > 0
    ? inv.lignes
    : [{ designation: inv.objet, quantite: 1, unite: "C62", prixUnitaireHt: inv.montantHt, montantHt: inv.montantHt }];

  const lignesXml = lignes.map((l, i) => `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(l.designation)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${fmtNum(l.prixUnitaireHt)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${esc(l.unite || "C62")}">${fmtNum(l.quantite)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${esc(category)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmtNum(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${fmtNum(l.montantHt)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>A1</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(inv.numero)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${fmtDate(inv.dateEmission)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lignesXml}
    <ram:ApplicableHeaderTradeAgreement>
${partyXml("SellerTradeParty", inv.vendeur)}
${partyXml("BuyerTradeParty", inv.acheteur)}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${fmtDate(inv.dateEmission)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${fmtNum(taxAmount)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${fmtNum(basis)}</ram:BasisAmount>
        <ram:CategoryCode>${esc(category)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${fmtNum(rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>${inv.dateEcheance ? `
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${fmtDate(inv.dateEcheance)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ""}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmtNum(basis)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmtNum(basis)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmtNum(taxAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmtNum(grandTotal)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmtNum(grandTotal)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}

/** Verifie que toutes les donnees obligatoires EN16931 sont presentes avant transmission. */
export function validateFacturxInvoice(inv: FacturxInvoiceInput): string[] {
  const errs: string[] = [];
  const cleanSiret = (inv.vendeur.siret || "").replace(/\s+/g, "");
  if (!/^\d{14}$/.test(cleanSiret)) {
    errs.push("SIRET de l'entreprise manquant ou invalide (14 chiffres requis) — a completer dans Parametres > Entreprise");
  }
  if (!inv.vendeur.adresse?.trim() || !inv.vendeur.codePostal?.trim() || !inv.vendeur.ville?.trim()) {
    errs.push("Adresse de l'entreprise incomplete — a completer dans Parametres > Entreprise");
  }
  if (!inv.acheteur.nom?.trim()) errs.push("Nom du client manquant");
  if (!inv.acheteur.adresse?.trim() || !inv.acheteur.codePostal?.trim() || !inv.acheteur.ville?.trim()) {
    errs.push("Adresse du client incomplete — a completer dans la facture (adresse, code postal, ville)");
  }
  if (!Number.isFinite(inv.montantHt) || inv.montantHt < 0) errs.push("Montant HT invalide");
  if (!Number.isFinite(inv.tauxTva) || inv.tauxTva < 0) errs.push("Taux de TVA invalide");
  return errs;
}
