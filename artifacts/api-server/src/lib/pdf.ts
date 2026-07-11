import PDFDocument from "pdfkit";
import type { Response } from "express";
import { join } from "node:path";
import type { licencesTable } from "@magestion/db";
import { STORAGE_DIR } from "./storage.js";

interface LicenceInfo {
  nom: string;
  siret: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  email: string | null;
  telephone: string | null;
  tvaIntracommunautaire: string | null;
  logoAbsolutePath: string | null;
}

// Mappe la ligne licence brute (DB) vers les champs attendus par le PDF —
// partage entre devis.ts et factures.ts pour eviter 4 copies divergentes.
export function licenceToPdfInfo(licence: typeof licencesTable.$inferSelect | undefined): LicenceInfo {
  return {
    nom: licence?.nom ?? "",
    siret: licence?.siret ?? null,
    adresse: licence?.adresse ?? null,
    codePostal: licence?.codePostal ?? null,
    ville: licence?.ville ?? null,
    email: licence?.email ?? null,
    telephone: licence?.telephone ?? null,
    tvaIntracommunautaire: licence?.tvaIntracommunautaire ?? null,
    logoAbsolutePath: licence?.logoChemin ? join(STORAGE_DIR, licence.logoChemin) : null,
  };
}

interface DocumentPdfData {
  type: "DEVIS" | "FACTURE";
  numero: string;
  dateEmission: Date;
  dateEcheance?: string | null;
  client: string;
  objet: string;
  montantHt: number;
  tauxTva: number;
  licence: LicenceInfo;
}

// Les polices standard PDF (Helvetica) ne supportent que WinAnsiEncoding : le
// separateur de milliers "fr-FR" (espace fine insecable U+202F) n'en fait pas
// partie et s'affiche comme un caractere errone — on le remplace par un espace normal.
const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, " ");
const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR");

// Dessine le contenu devis/facture sur un PDFDocument deja ouvert — partagee
// par la version "stream vers la reponse HTTP" et la version "buffer pour
// piece jointe email", pour ne jamais dupliquer la mise en page.
function drawDocument(doc: PDFKit.PDFDocument, data: DocumentPdfData) {
  const montantTva = data.montantHt * (data.tauxTva / 100);
  const montantTtc = data.montantHt + montantTva;

  // --- En-tete emetteur ---
  if (data.licence.logoAbsolutePath) {
    try {
      doc.image(data.licence.logoAbsolutePath, 450, 45, { fit: [100, 60] });
    } catch {
      // Fichier logo illisible/corrompu : on ne bloque jamais la generation du PDF pour ca.
    }
  }
  doc.fontSize(16).font("Helvetica-Bold").text(data.licence.nom);
  doc.fontSize(9).font("Helvetica");
  if (data.licence.adresse) doc.text(data.licence.adresse);
  if (data.licence.codePostal || data.licence.ville) doc.text(`${data.licence.codePostal ?? ""} ${data.licence.ville ?? ""}`.trim());
  if (data.licence.siret) doc.text(`SIRET : ${data.licence.siret}`);
  if (data.licence.tvaIntracommunautaire) doc.text(`TVA intracommunautaire : ${data.licence.tvaIntracommunautaire}`);
  if (data.licence.telephone) doc.text(`Tel : ${data.licence.telephone}`);
  if (data.licence.email) doc.text(`Email : ${data.licence.email}`);

  // --- Titre document ---
  // Garantit un espace minimal avant le titre, sinon un en-tete societe court
  // (peu de champs renseignes) laisse le titre chevaucher le logo (zone fixe
  // en haut a droite, hauteur jusqu'a 45+60=105).
  if (data.licence.logoAbsolutePath) doc.y = Math.max(doc.y, 115);
  doc.moveDown(1.5);
  doc.fontSize(20).font("Helvetica-Bold").text(`${data.type === "DEVIS" ? "DEVIS" : "FACTURE"} N° ${data.numero}`, { align: "right" });
  doc.fontSize(10).font("Helvetica").text(`Date d'emission : ${fmtDate(data.dateEmission)}`, { align: "right" });
  if (data.dateEcheance) doc.text(`Date d'echeance : ${fmtDate(data.dateEcheance)}`, { align: "right" });

  // --- Client ---
  doc.moveDown(1.5);
  doc.fontSize(11).font("Helvetica-Bold").text("Client");
  doc.fontSize(10).font("Helvetica").text(data.client);

  // --- Tableau prestation ---
  doc.moveDown(1.5);
  const tableTop = doc.y;
  const col = { objet: 50, ht: 300, tva: 380, ttc: 460 };
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Designation", col.objet, tableTop);
  doc.text("Montant HT", col.ht, tableTop, { width: 70, align: "right" });
  doc.text("TVA", col.tva, tableTop, { width: 60, align: "right" });
  doc.text("Montant TTC", col.ttc, tableTop, { width: 90, align: "right" });
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  const rowY = tableTop + 22;
  doc.fontSize(10).font("Helvetica");
  doc.text(data.objet, col.objet, rowY, { width: 240 });
  doc.text(`${fmt(data.montantHt)} €`, col.ht, rowY, { width: 70, align: "right" });
  doc.text(`${data.tauxTva} %`, col.tva, rowY, { width: 60, align: "right" });
  doc.text(`${fmt(montantTtc)} €`, col.ttc, rowY, { width: 90, align: "right" });

  doc.moveTo(50, rowY + 30).lineTo(550, rowY + 30).stroke();

  // --- Totaux ---
  let totalsY = rowY + 45;
  doc.fontSize(10).font("Helvetica");
  doc.text("Total HT :", 380, totalsY, { width: 80, align: "right" });
  doc.text(`${fmt(data.montantHt)} €`, 460, totalsY, { width: 90, align: "right" });
  totalsY += 16;
  doc.text(`TVA (${data.tauxTva} %) :`, 380, totalsY, { width: 80, align: "right" });
  doc.text(`${fmt(montantTva)} €`, 460, totalsY, { width: 90, align: "right" });
  totalsY += 16;
  doc.font("Helvetica-Bold");
  doc.text("Total TTC :", 380, totalsY, { width: 80, align: "right" });
  doc.text(`${fmt(montantTtc)} €`, 460, totalsY, { width: 90, align: "right" });

  // --- Mentions legales ---
  doc.fontSize(8).font("Helvetica").fillColor("#555555");
  const mentionsY = 720;
  if (data.type === "DEVIS") {
    doc.text("Devis valable 30 jours a compter de la date d'emission. Bon pour accord (date, signature et cachet) :", 50, mentionsY, { width: 500 });
  } else {
    doc.text(
      "En cas de retard de paiement, une penalite egale a 3 fois le taux d'interet legal sera appliquee, ainsi qu'une indemnite forfaitaire de 40 € pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce). Pas d'escompte pour paiement anticipe.",
      50,
      mentionsY,
      { width: 500 },
    );
  }
}

// Genere un PDF devis/facture minimal mais conforme (mentions legales de base) et
// l'ecrit directement dans la reponse HTTP — pas de fichier temporaire sur disque.
export function streamDocumentPdf(res: Response, data: DocumentPdfData) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const filename = `${data.type.toLowerCase()}-${data.numero}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  drawDocument(doc, data);
  doc.end();
}

// Meme rendu, mais collecte en Buffer — utilise pour joindre le PDF a un email
// plutot que de l'ecrire dans une reponse HTTP.
export function renderDocumentPdfBuffer(data: DocumentPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawDocument(doc, data);
    doc.end();
  });
}
