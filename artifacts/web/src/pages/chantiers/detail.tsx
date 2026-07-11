import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORIE_LABELS,
  STATUT_LABELS,
  getProject,
  updateProject,
  type ProjectCategorie,
  type ProjectInput,
  type ProjectStatut,
} from "@/lib/projects";

export default function ChantierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => getProject(id),
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<ProjectInput>({ nom: "", client: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    if (!project) return;
    setForm({
      nom: project.nom,
      client: project.client,
      adresse: project.adresse ?? undefined,
      codePostal: project.codePostal ?? undefined,
      budgetEstimeHt: Number(project.budgetEstimeHt),
      objectifMargePercent: Number(project.objectifMargePercent),
      categorie: project.categorie,
    });
    setError(null);
    setIsEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateProject(id, form);
      await queryClient.invalidateQueries({ queryKey: ["projects", id] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit}>Modifier</Button>
            <Button variant="outline" onClick={handleToggleActive}>
              {project.active ? "Archiver" : "Reactiver"}
            </Button>
          </div>
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

      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <DialogHeader>
          <DialogTitle>Modifier le chantier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client">Client</Label>
              <Input id="client" required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" value={form.adresse ?? ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="codePostal">Code postal</Label>
              <Input id="codePostal" value={form.codePostal ?? ""} onChange={(e) => setForm({ ...form, codePostal: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budgetEstimeHt">Budget estime HT (€)</Label>
              <Input
                id="budgetEstimeHt"
                type="number"
                min={0}
                value={form.budgetEstimeHt ?? 0}
                onChange={(e) => setForm({ ...form, budgetEstimeHt: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="objectifMargePercent">Objectif marge (%)</Label>
              <Input
                id="objectifMargePercent"
                type="number"
                min={0}
                max={100}
                value={form.objectifMargePercent ?? 0}
                onChange={(e) => setForm({ ...form, objectifMargePercent: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categorie">Categorie</Label>
            <select
              id="categorie"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.categorie ?? "AUTRE"}
              onChange={(e) => setForm({ ...form, categorie: e.target.value as ProjectCategorie })}
            >
              {Object.entries(CATEGORIE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
