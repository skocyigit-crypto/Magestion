import "./env.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { authLimiter, aiLimiter } from "./lib/rateLimit.js";
import { extractUser } from "./middleware/extractUser.js";
import { checkLicenceGate } from "./middleware/checkLicenceGate.js";
import { projectsRouter } from "./routes/projects.js";
import { prospectsRouter } from "./routes/prospects.js";
import { devisRouter } from "./routes/devis.js";
import { facturesRouter } from "./routes/factures.js";
import { depensesRouter } from "./routes/depenses.js";
import { commandesRouter } from "./routes/commandes.js";
import { situationsRouter } from "./routes/situations.js";
import { comptabiliteRouter } from "./routes/comptabilite.js";
import { employeesRouter } from "./routes/employees.js";
import { pointageRouter } from "./routes/pointage.js";
import { planningPersonnelRouter } from "./routes/planningPersonnel.js";
import { sousTraitantsRouter } from "./routes/sousTraitants.js";
import { securiteRouter } from "./routes/securite.js";
import { articlesRouter } from "./routes/articles.js";
import { ouvragesRouter } from "./routes/ouvrages.js";
import { stockRouter } from "./routes/stock.js";
import { documentsRouter } from "./routes/documents.js";
import { vehiclesRouter } from "./routes/vehicles.js";
import { agendaRouter } from "./routes/agenda.js";
import { relancesRouter } from "./routes/relances.js";
import { aiImportRouter } from "./routes/aiImport.js";
import { agentRouter } from "./routes/agent.js";
import { usersRouter } from "./routes/users.js";
import { parametresRouter } from "./routes/parametres.js";
import { transactionsBancairesRouter } from "./routes/transactionsBancaires.js";
import { rgpdRouter } from "./routes/rgpd.js";
import { notesDeFraisRouter } from "./routes/notesDeFrais.js";
import { locationsMaterielRouter } from "./routes/locationsMateriel.js";
import { prorataRouter } from "./routes/prorata.js";
import { analyticsCommercialRouter } from "./routes/analyticsCommercial.js";
import { avoirsRouter } from "./routes/avoirs.js";
import { retenuesGarantieRouter } from "./routes/retenuesGarantie.js";
import { declarationsTvaRouter } from "./routes/declarationsTva.js";
import { chantierPlanningRouter } from "./routes/chantierPlanning.js";
import { clientsRouter } from "./routes/clients.js";
import { fournisseursRouter } from "./routes/fournisseurs.js";
import { billingRouter } from "./routes/billing.js";
import { stripeWebhookRouter } from "./routes/stripe-webhook.js";
import { superAdminRouter } from "./routes/super-admin.js";
import { tachesRouter } from "./routes/taches.js";
import { clotureComptableRouter } from "./routes/clotureComptable.js";
import { immobilisationsRouter } from "./routes/immobilisations.js";
import { appelsOffresRouter } from "./routes/appelsOffres.js";
import { marchesPublicsRouter } from "./routes/marchesPublics.js";
import { lotsMarcheRouter } from "./routes/lotsMarche.js";
import { executionMarcheRouter } from "./routes/executionMarche.js";
import { doeMarcheRouter } from "./routes/doeMarche.js";
import { archivesDecennalesRouter } from "./routes/archivesDecennales.js";
import { indicesBtRouter } from "./routes/indicesBt.js";
import { budgetsPostesRouter } from "./routes/budgetsPostes.js";
import { tarifsFournisseursRouter } from "./routes/tarifsFournisseurs.js";
import { gestionDechetsRouter } from "./routes/gestionDechets.js";
import { bilanCarboneRouter } from "./routes/bilanCarbone.js";
import { bonsLivraisonRouter } from "./routes/bonsLivraison.js";
import { demandesAchatRouter } from "./routes/demandesAchat.js";
import { sousChantiersRouter } from "./routes/sousChantiers.js";
import { closeDb } from "@magestion/db";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(",");

// CSP adaptee a un front Vite servi en same-origin (build sans nonce,
// scripts/styles en fichiers externes /assets/*) + attributs style inline
// React (ex: barres de progression Gantt) — 'unsafe-inline' limite a
// style-src uniquement, script-src reste strict.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'"],
      },
    },
  }),
);
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Sert le front (build Vite statique) depuis le MEME conteneur/origine que
// l'API — evite tout probleme CORS en production et un second service a
// deployer. Absent en dev (le front tourne alors sur son propre serveur Vite,
// voir README) : le dossier n'existe que si `pnpm --filter @magestion/web run build` a tourne.
const WEB_DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "dist");
const SERVE_WEB = existsSync(WEB_DIST);
if (SERVE_WEB) {
  app.use(express.static(WEB_DIST));
}

// Corps BRUT requis pour la verification de signature Stripe (HMAC sur les
// octets exacts recus) — DOIT etre monte avant express.json() ci-dessous,
// sinon le corps est deja (re)serialise en JSON et la signature ne matche plus.
app.use("/api/stripe-webhook", express.raw({ type: "application/json" }), stripeWebhookRouter);

app.use(express.json({ limit: "2mb" }));

// --- Routes publiques (PAS de extractUser) ---
app.use("/api/health", healthRouter);
app.use("/api/auth", authLimiter, authRouter);

// --- A partir d'ici : tout /api/* exige un JWT valide. ---
// Nouvelles routes tenant (chantiers, devis, clients...) se montent APRES
// cette ligne, jamais avant — c'est le garde-fou central anti "route oubliee".
app.use("/api", extractUser);

// Licence suspendue/essai expire : bloque avant meme le RBAC par module (une
// licence coupee ne doit voir aucune route tenant, quel que soit le role).
// "/api/billing" reste exempte (voir SAFE_PATH_PREFIXES) pour permettre de
// consulter son statut et se reabonner.
app.use("/api", checkLicenceGate);

app.use("/api/projects", projectsRouter);
app.use("/api/prospects", prospectsRouter);
app.use("/api/devis", devisRouter);
app.use("/api/factures", facturesRouter);
app.use("/api/depenses", depensesRouter);
app.use("/api/commandes", commandesRouter);
app.use("/api/situations", situationsRouter);
app.use("/api/comptabilite", comptabiliteRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/pointage", pointageRouter);
app.use("/api/planning-personnel", planningPersonnelRouter);
app.use("/api/sous-traitants", sousTraitantsRouter);
app.use("/api/securite", securiteRouter);
app.use("/api/articles", articlesRouter);
app.use("/api/ouvrages", ouvragesRouter);
app.use("/api/stock", stockRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/agenda", agendaRouter);
app.use("/api/relances", relancesRouter);
app.use("/api/ai-import", aiLimiter, aiImportRouter);
app.use("/api/agent", aiLimiter, agentRouter);
app.use("/api/users", usersRouter);
app.use("/api/parametres", parametresRouter);
app.use("/api/transactions-bancaires", transactionsBancairesRouter);
app.use("/api/rgpd", rgpdRouter);
app.use("/api/notes-de-frais", notesDeFraisRouter);
app.use("/api/locations-materiel", locationsMaterielRouter);
app.use("/api/prorata", prorataRouter);
app.use("/api/analytics-commercial", analyticsCommercialRouter);
app.use("/api/avoirs", avoirsRouter);
app.use("/api/retenues-garantie", retenuesGarantieRouter);
app.use("/api/declarations-tva", declarationsTvaRouter);
app.use("/api/planning-chantier", chantierPlanningRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/fournisseurs", fournisseursRouter);
app.use("/api/billing", billingRouter);
app.use("/api/super-admin", superAdminRouter);
app.use("/api/taches", tachesRouter);
app.use("/api/cloture-comptable", clotureComptableRouter);
app.use("/api/immobilisations", immobilisationsRouter);
app.use("/api/appels-offres", appelsOffresRouter);
app.use("/api/marches-publics", marchesPublicsRouter);
app.use("/api/lots-marche", lotsMarcheRouter);
app.use("/api/execution-marche", executionMarcheRouter);
app.use("/api/doe-marche", doeMarcheRouter);
app.use("/api/archives-decennales", archivesDecennalesRouter);
app.use("/api/indices-bt", indicesBtRouter);
app.use("/api/budgets-postes", budgetsPostesRouter);
app.use("/api/tarifs-fournisseurs", tarifsFournisseursRouter);
app.use("/api/gestion-dechets", gestionDechetsRouter);
app.use("/api/bilan-carbone", bilanCarboneRouter);
app.use("/api/bons-livraison", bonsLivraisonRouter);
app.use("/api/demandes-achat", demandesAchatRouter);
app.use("/api/sous-chantiers", sousChantiersRouter);

// Fallback SPA : toute route non-/api sans fichier statique correspondant
// (ex: /chantiers/abc-123, rafraichie directement) renvoie index.html —
// wouter prend ensuite le relais cote client. Les /api/* non matches restent
// en 404 JSON (jamais de page HTML pour un appel API).
if (SERVE_WEB) {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(WEB_DIST, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

const server = app.listen(PORT, () => {
  console.log(`[api-server] Magestion ecoute sur le port ${PORT}`);
});

// Indispensable avec PGlite (mode dev sans DATABASE_URL) : un arret brutal
// laisse un postmaster.pid orphelin qui casse le prochain demarrage.
async function shutdown() {
  server.close();
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
