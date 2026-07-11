import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PIPELINE_STAGES,
  STATUT_LABELS,
  URGENCE_LABELS,
  getProspect,
  updateProspect,
  type ProspectStatut,
} from "@/lib/prospects";

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: prospect, isLoading } = useQuery({
    queryKey: ["prospects", id],
    queryFn: () => getProspect(id),
  });

  async function handleStatutChange(statut: ProspectStatut) {
    await updateProspect(id, { statut });
    await queryClient.invalidateQueries({ queryKey: ["prospects", id] });
    await queryClient.invalidateQueries({ queryKey: ["prospects"] });
  }

  // Pas de suppression : archivage reversible uniquement (regle produit).
  async function handleToggleActive() {
    if (!prospect) return;
    await updateProspect(id, { active: !prospect.active });
    await queryClient.invalidateQueries({ queryKey: ["prospects", id] });
    await queryClient.invalidateQueries({ queryKey: ["prospects"] });
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (!prospect) return <Layout><p className="p-8 text-muted-foreground">Prospect introuvable.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{prospect.nom}</h1>
            <p className="text-muted-foreground">{prospect.contact || "—"}</p>
          </div>
          <Button variant="outline" onClick={handleToggleActive}>
            {prospect.active ? "Archiver" : "Reactiver"}
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Score</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{prospect.score} / 100</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Budget estime</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(prospect.budgetEstime).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Urgence</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{URGENCE_LABELS[prospect.urgence]}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent>
              <select
                className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm"
                value={prospect.statut}
                onChange={(e) => handleStatutChange(e.target.value as ProspectStatut)}
              >
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>{STATUT_LABELS[stage]}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Coordonnees</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>Telephone : {prospect.telephone || "—"}</p>
            <p>Email : {prospect.email || "—"}</p>
            <p>Adresse : {prospect.adresse || "—"}{prospect.codePostal ? ` (${prospect.codePostal})` : ""}</p>
          </CardContent>
        </Card>

        {prospect.notes && (
          <Card className="mt-4">
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{prospect.notes}</p></CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
