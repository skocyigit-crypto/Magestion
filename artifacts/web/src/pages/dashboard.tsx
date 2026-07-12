import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/layout";
import { listProjects } from "@/lib/projects";
import { listFactures } from "@/lib/factures";
import { CATEGORIE_LABELS, listDepenses, type DepenseCategorie } from "@/lib/depenses";
import { listDevis, montantTtc } from "@/lib/devis";
import { listRelancesAFaire } from "@/lib/relances";
import { CHART_COLORS, GroupedBarChart, HorizontalBarChart } from "@/components/bar-chart";

const fmtEuro = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function DashboardPage() {
  const { data: projects, isLoading: projectsLoading, isError: projectsError } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: factures, isLoading: facturesLoading, isError: facturesError } = useQuery({ queryKey: ["factures"], queryFn: listFactures });
  const { data: depenses, isLoading: depensesLoading, isError: depensesError } = useQuery({ queryKey: ["depenses"], queryFn: () => listDepenses() });
  const { data: devisList, isLoading: devisLoading, isError: devisError } = useQuery({ queryKey: ["devis"], queryFn: listDevis });
  const { data: relances, isLoading: relancesLoading, isError: relancesError } = useQuery({ queryKey: ["relances", "a-faire"], queryFn: listRelancesAFaire });
  const isLoading = projectsLoading || facturesLoading || depensesLoading || devisLoading || relancesLoading;
  const isError = projectsError || facturesError || depensesError || devisError || relancesError;

  const allProjects = projects ?? [];
  const allFactures = factures ?? [];
  const allDepenses = depenses ?? [];
  const allDevis = devisList ?? [];

  const budgetEngage = allProjects.reduce((sum, p) => sum + Number(p.budgetEstimeHt), 0);
  const margeMoyenne = allProjects.length
    ? allProjects.reduce((sum, p) => sum + Number(p.objectifMargePercent), 0) / allProjects.length
    : null;
  const aRisque = allProjects.filter((p) => Number(p.objectifMargePercent) < 15).length;

  const facturesEmises = allFactures.filter((f) => f.statut !== "BROUILLON");
  const chiffreAffaires = facturesEmises.reduce((sum, f) => sum + montantTtc(f.montantHt, f.tauxTva), 0);
  const encaisse = allFactures.filter((f) => f.statut === "PAYEE").reduce((sum, f) => sum + montantTtc(f.montantHt, f.tauxTva), 0);
  const enAttentePaiement = allFactures.filter((f) => f.statut === "ENVOYEE" || f.statut === "EN_RETARD");
  const montantEnAttente = enAttentePaiement.reduce((sum, f) => sum + montantTtc(f.montantHt, f.tauxTva), 0);
  const enRetard = allFactures.filter((f) => f.statut === "EN_RETARD").length;

  const depensesPayees = allDepenses.filter((d) => d.statut === "PAYEE").reduce((sum, d) => sum + montantTtc(d.montantHt, d.tauxTva), 0);
  const tresorerie = encaisse - depensesPayees;

  const devisEnAttente = allDevis.filter((d) => d.statut === "ENVOYE").length;
  const devisClos = allDevis.filter((d) => d.statut === "ACCEPTE" || d.statut === "REFUSE").length;
  const devisAcceptes = allDevis.filter((d) => d.statut === "ACCEPTE").length;
  const tauxTransformation = devisClos > 0 ? Math.round((devisAcceptes / devisClos) * 100) : null;

  const relancesAFaire = (relances ?? []).length;

  // CA mensuel (6 derniers mois) : facture vs encaisse, meme unite (€) -> un seul axe.
  const moisLabels: string[] = [];
  const factureParMois: number[] = [];
  const encaisseParMois: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const moisKey = `${d.getFullYear()}-${d.getMonth()}`;
    moisLabels.push(d.toLocaleDateString("fr-FR", { month: "short" }));
    const facturesDuMois = facturesEmises.filter((f) => {
      const fd = new Date(f.createdAt);
      return `${fd.getFullYear()}-${fd.getMonth()}` === moisKey;
    });
    factureParMois.push(round2(facturesDuMois.reduce((s, f) => s + montantTtc(f.montantHt, f.tauxTva), 0)));
    const payeesDuMois = allFactures.filter((f) => {
      if (f.statut !== "PAYEE" || !f.updatedAt) return false;
      const pd = new Date(f.updatedAt);
      return `${pd.getFullYear()}-${pd.getMonth()}` === moisKey;
    });
    encaisseParMois.push(round2(payeesDuMois.reduce((s, f) => s + montantTtc(f.montantHt, f.tauxTva), 0)));
  }

  // Depenses par categorie (actives), ordre fixe = ordre de l'enum (identite, pas magnitude).
  const categories: DepenseCategorie[] = ["MATERIAUX", "MAIN_OEUVRE", "SOUS_TRAITANCE", "MATERIEL", "ADMINISTRATIF", "AUTRE"];
  const depensesParCategorie = categories
    .map((cat, i) => ({
      label: CATEGORIE_LABELS[cat],
      value: round2(allDepenses.filter((d) => d.categorie === cat).reduce((s, d) => s + montantTtc(d.montantHt, d.tauxTva), 0)),
      color: CHART_COLORS[i],
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const kpis = [
    { label: "Chantiers actifs", value: String(allProjects.length) },
    { label: "Budget engage", value: fmtEuro(budgetEngage) },
    { label: "Chiffre d'affaires facture", value: fmtEuro(chiffreAffaires) },
    { label: "Encaisse", value: fmtEuro(encaisse) },
    {
      label: "Tresorerie (encaisse - depenses)",
      value: fmtEuro(tresorerie),
      accent: tresorerie < 0 ? "text-red-400" : "text-emerald-400",
    },
    {
      label: "En attente de paiement",
      value: `${fmtEuro(montantEnAttente)} (${enAttentePaiement.length})`,
      accent: enRetard > 0 ? "text-orange-400" : undefined,
    },
    { label: "Marge moyenne", value: margeMoyenne !== null ? `${margeMoyenne.toFixed(1)} %` : "—" },
    { label: "Chantiers a risque", value: String(aRisque), accent: aRisque > 0 ? "text-orange-400" : undefined },
    { label: "Devis en attente", value: String(devisEnAttente) },
    { label: "Taux de transformation devis", value: tauxTransformation !== null ? `${tauxTransformation} %` : "—" },
    {
      label: "Relances a faire",
      value: String(relancesAFaire),
      accent: relancesAFaire > 0 ? "text-orange-400" : undefined,
    },
    { label: "Factures en retard", value: String(enRetard), accent: enRetard > 0 ? "text-red-400" : undefined },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Tableau de bord</h1>
        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="mb-4 text-muted-foreground">Chargement...</p>}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader>
                <CardTitle>{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-semibold ${kpi.accent ?? ""}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Chiffre d'affaires mensuel (6 derniers mois)</CardTitle></CardHeader>
            <CardContent>
              <GroupedBarChart
                categories={moisLabels}
                series={[
                  { label: "Facture", color: "#3987e5", values: factureParMois },
                  { label: "Encaisse", color: "#199e70", values: encaisseParMois },
                ]}
                formatValue={fmtEuro}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Depenses par categorie</CardTitle></CardHeader>
            <CardContent>
              {depensesParCategorie.length > 0 ? (
                <HorizontalBarChart data={depensesParCategorie} formatValue={fmtEuro} />
              ) : (
                <p className="text-sm text-muted-foreground">Aucune depense enregistree.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
