import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/layout";
import { listProjects } from "@/lib/projects";

export default function DashboardPage() {
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const budgetEngage = (projects ?? []).reduce((sum, p) => sum + Number(p.budgetEstimeHt), 0);
  const margeMoyenne = projects?.length
    ? projects.reduce((sum, p) => sum + Number(p.objectifMargePercent), 0) / projects.length
    : null;
  const aRisque = (projects ?? []).filter((p) => Number(p.objectifMargePercent) < 15).length;

  // Depenses/Tresorerie restent a 0 tant que le module Factures (Phase 2) n'existe pas.
  const kpis = [
    { label: "Chantiers", value: String(projects?.length ?? 0) },
    { label: "Budget engage", value: `${budgetEngage.toLocaleString("fr-FR")} €` },
    { label: "Depenses", value: "0 €" },
    { label: "Tresorerie", value: "0 €" },
    { label: "Marge moyenne", value: margeMoyenne !== null ? `${margeMoyenne.toFixed(1)} %` : "—" },
    { label: "A risque", value: String(aRisque) },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Tableau de bord</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader>
                <CardTitle>{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
