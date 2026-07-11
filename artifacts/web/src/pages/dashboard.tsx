import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/layout";
import { listProjects } from "@/lib/projects";
import { listFactures } from "@/lib/factures";
import { listDepenses } from "@/lib/depenses";
import { listDevis, montantTtc } from "@/lib/devis";
import { listRelancesAFaire } from "@/lib/relances";

const fmtEuro = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;

export default function DashboardPage() {
  const { data: projects, isLoading: projectsLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: factures, isLoading: facturesLoading } = useQuery({ queryKey: ["factures"], queryFn: listFactures });
  const { data: depenses, isLoading: depensesLoading } = useQuery({ queryKey: ["depenses"], queryFn: () => listDepenses() });
  const { data: devisList, isLoading: devisLoading } = useQuery({ queryKey: ["devis"], queryFn: listDevis });
  const { data: relances, isLoading: relancesLoading } = useQuery({ queryKey: ["relances", "a-faire"], queryFn: listRelancesAFaire });
  const isLoading = projectsLoading || facturesLoading || depensesLoading || devisLoading || relancesLoading;

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
      </div>
    </Layout>
  );
}
