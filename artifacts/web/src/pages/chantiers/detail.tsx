import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATEGORIE_LABELS, STATUT_LABELS, getProject, updateProject, type ProjectStatut } from "@/lib/projects";

export default function ChantierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => getProject(id),
  });

  async function handleStatutChange(statut: ProjectStatut) {
    await updateProject(id, { statut });
    await queryClient.invalidateQueries({ queryKey: ["projects", id] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  // Pas de suppression : archivage reversible uniquement (regle produit).
  async function handleToggleActive() {
    if (!project) return;
    await updateProject(id, { active: !project.active });
    await queryClient.invalidateQueries({ queryKey: ["projects", id] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (!project) return <Layout><p className="p-8 text-muted-foreground">Chantier introuvable.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{project.nom}</h1>
            <p className="text-muted-foreground">{project.client}</p>
          </div>
          <Button variant="outline" onClick={handleToggleActive}>
            {project.active ? "Archiver" : "Reactiver"}
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Budget estime</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(project.budgetEstimeHt).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Objectif marge</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{project.objectifMargePercent} %</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Categorie</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{CATEGORIE_LABELS[project.categorie]}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent>
              <select
                className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm"
                value={project.statut}
                onChange={(e) => handleStatutChange(e.target.value as ProjectStatut)}
              >
                {Object.entries(STATUT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Adresse</CardTitle></CardHeader>
          <CardContent>
            <p>{project.adresse || "—"}{project.codePostal ? ` (${project.codePostal})` : ""}</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
