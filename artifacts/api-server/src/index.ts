import "./env.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { authLimiter, aiLimiter } from "./lib/rateLimit.js";
import { extractUser } from "./middleware/extractUser.js";
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
import { closeDb } from "@magestion/db";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(",");

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// --- Routes publiques (PAS de extractUser) ---
app.use("/api/health", healthRouter);
app.use("/api/auth", authLimiter, authRouter);

// --- A partir d'ici : tout /api/* exige un JWT valide. ---
// Nouvelles routes tenant (chantiers, devis, clients...) se montent APRES
// cette ligne, jamais avant — c'est le garde-fou central anti "route oubliee".
app.use("/api", extractUser);

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
