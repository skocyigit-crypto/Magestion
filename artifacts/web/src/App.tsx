import { Suspense, lazy } from "react";
import { Redirect, Route, Switch } from "wouter";

// Chaque page en lazy import des le depart (leçon BTP-ULTRA-OS : 185+ pages
// chargees en eager causaient un bundle initial monolithique).
const LoginPage = lazy(() => import("@/pages/login"));
const SignupPage = lazy(() => import("@/pages/signup/index"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const ChantiersPage = lazy(() => import("@/pages/chantiers/index"));
const ChantierDetailPage = lazy(() => import("@/pages/chantiers/detail"));
const ClientsPage = lazy(() => import("@/pages/clients/index"));
const ClientDetailPage = lazy(() => import("@/pages/clients/detail"));
const ProspectsPage = lazy(() => import("@/pages/prospects/index"));
const ProspectDetailPage = lazy(() => import("@/pages/prospects/detail"));
const DevisPage = lazy(() => import("@/pages/devis/index"));
const DevisDetailPage = lazy(() => import("@/pages/devis/detail"));
const FacturesPage = lazy(() => import("@/pages/factures/index"));
const FactureDetailPage = lazy(() => import("@/pages/factures/detail"));
const AvoirsPage = lazy(() => import("@/pages/avoirs/index"));
const DepensesPage = lazy(() => import("@/pages/depenses/index"));
const CommandesPage = lazy(() => import("@/pages/commandes/index"));
const SituationsPage = lazy(() => import("@/pages/situations/index"));
const ComptabilitePage = lazy(() => import("@/pages/comptabilite/index"));
const RapprochementBancairePage = lazy(() => import("@/pages/rapprochement-bancaire/index"));
const EquipePage = lazy(() => import("@/pages/equipe/index"));
const EmployeeDetailPage = lazy(() => import("@/pages/equipe/detail"));
const PointagePage = lazy(() => import("@/pages/pointage/index"));
const PlanningPersonnelPage = lazy(() => import("@/pages/planning-personnel/index"));
const SousTraitantsPage = lazy(() => import("@/pages/sous-traitants/index"));
const SecuritePage = lazy(() => import("@/pages/securite/index"));
const ArticlesPage = lazy(() => import("@/pages/articles/index"));
const OuvragesPage = lazy(() => import("@/pages/ouvrages/index"));
const StockPage = lazy(() => import("@/pages/stock/index"));
const DocumentsPage = lazy(() => import("@/pages/documents/index"));
const VehiculesPage = lazy(() => import("@/pages/vehicules/index"));
const AgendaCommercialPage = lazy(() => import("@/pages/agenda-commercial/index"));
const RelancesPage = lazy(() => import("@/pages/relances/index"));
const ImportIaPage = lazy(() => import("@/pages/import-ia/index"));
const UtilisateursPage = lazy(() => import("@/pages/utilisateurs/index"));
const ParametresPage = lazy(() => import("@/pages/parametres/index"));
const RgpdPage = lazy(() => import("@/pages/rgpd/index"));
const NotesDeFraisPage = lazy(() => import("@/pages/notes-de-frais/index"));
const LocationsMaterielPage = lazy(() => import("@/pages/locations-materiel/index"));
const AnalyticsCommercialPage = lazy(() => import("@/pages/analytics-commercial/index"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Chargement...</div>}>
      <Switch>
        <Route path="/" component={() => <Redirect to="/login" />} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/chantiers" component={ChantiersPage} />
        <Route path="/chantiers/:id" component={ChantierDetailPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/clients/:id" component={ClientDetailPage} />
        <Route path="/prospects" component={ProspectsPage} />
        <Route path="/prospects/:id" component={ProspectDetailPage} />
        <Route path="/devis" component={DevisPage} />
        <Route path="/devis/:id" component={DevisDetailPage} />
        <Route path="/factures" component={FacturesPage} />
        <Route path="/factures/:id" component={FactureDetailPage} />
        <Route path="/avoirs" component={AvoirsPage} />
        <Route path="/depenses" component={DepensesPage} />
        <Route path="/commandes" component={CommandesPage} />
        <Route path="/situations" component={SituationsPage} />
        <Route path="/comptabilite" component={ComptabilitePage} />
        <Route path="/rapprochement-bancaire" component={RapprochementBancairePage} />
        <Route path="/equipe" component={EquipePage} />
        <Route path="/equipe/:id" component={EmployeeDetailPage} />
        <Route path="/pointage" component={PointagePage} />
        <Route path="/planning-personnel" component={PlanningPersonnelPage} />
        <Route path="/sous-traitants" component={SousTraitantsPage} />
        <Route path="/securite" component={SecuritePage} />
        <Route path="/articles" component={ArticlesPage} />
        <Route path="/ouvrages" component={OuvragesPage} />
        <Route path="/stock" component={StockPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/vehicules" component={VehiculesPage} />
        <Route path="/agenda-commercial" component={AgendaCommercialPage} />
        <Route path="/relances" component={RelancesPage} />
        <Route path="/import-ia" component={ImportIaPage} />
        <Route path="/utilisateurs" component={UtilisateursPage} />
        <Route path="/parametres" component={ParametresPage} />
        <Route path="/rgpd" component={RgpdPage} />
        <Route path="/notes-de-frais" component={NotesDeFraisPage} />
        <Route path="/locations-materiel" component={LocationsMaterielPage} />
        <Route path="/analytics-commercial" component={AnalyticsCommercialPage} />
        <Route>404 — Page introuvable</Route>
      </Switch>
    </Suspense>
  );
}
