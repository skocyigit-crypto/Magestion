import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORIE_LABELS,
  STATUT_LABELS,
  createProject,
  listProjects,
  type ProjectCategorie,
  type ProjectInput,
} from "@/lib/projects";

const EMPTY_FORM: ProjectInput = { nom: "", client: "", adresse: "", codePostal: "", budgetEstimeHt: 0, objectifMargePercent: 0, categorie: "AUTRE" };

export default function ChantiersPage() {
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ProjectInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects ?? [];
    return (projects ?? []).filter(
      (p) => p.nom.toLowerCase().includes(q) || p.client.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const enCours = (projects ?? []).filter((p) => p.statut === "EN_COURS").length;
  const budgetTotal = (projects ?? []).reduce((sum, p) => sum + Number(p.budgetEstimeHt), 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createProject(form);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Chantiers</h1>
          <Button onClick={() => setIsOpen(true)}>Nouveau chantier</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total chantiers</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{projects?.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En cours</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{enCours}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Budget total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{budgetTotal.toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (nom, client)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-muted-foreground">Aucun chantier pour le moment.</p>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/chantiers/${p.id}`}>
              <Card className="cursor-pointer hover:border-primary">
                <CardHeader>
                  <CardTitle className="text-foreground">{p.nom}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <span>{p.client}</span>
                  <span>{Number(p.budgetEstimeHt).toLocaleString("fr-FR")} € — {STATUT_LABELS[p.statut]}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Nouveau chantier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom du chantier</Label>
            <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client">Client</Label>
            <Input id="client" required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="codePostal">Code postal</Label>
              <Input id="codePostal" value={form.codePostal} onChange={(e) => setForm({ ...form, codePostal: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget">Budget estime (€ HT)</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                value={form.budgetEstimeHt}
                onChange={(e) => setForm({ ...form, budgetEstimeHt: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="marge">Objectif de marge (%)</Label>
              <Input
                id="marge"
                type="number"
                min={0}
                max={100}
                value={form.objectifMargePercent}
                onChange={(e) => setForm({ ...form, objectifMargePercent: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categorie">Categorie</Label>
            <select
              id="categorie"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value as ProjectCategorie })}
            >
              {Object.entries(CATEGORIE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
