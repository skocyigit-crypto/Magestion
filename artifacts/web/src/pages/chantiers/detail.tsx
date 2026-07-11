import { useState } from "react";
import { Link, useParams } from "wouter";
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
import { DEVIS_STATUT_LABELS, listDevis, montantTtc } from "@/lib/devis";
import { FACTURE_STATUT_LABELS, listFactures } from "@/lib/factures";
import { STATUT_LABELS as DEPENSE_STATUT_LABELS, listDepenses } from "@/lib/depenses";
import { STATUT_LABELS as COMMANDE_STATUT_LABELS, listCommandes } from "@/lib/commandes";
import { STATUT_LABELS as SITUATION_STATUT_LABELS, listSituations } from "@/lib/situations";

export default function ChantierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => getProject(id),
  });

  const { data: devisList } = useQuery({ queryKey: ["devis"], queryFn: listDevis });
  const { data: facturesList } = useQuery({ queryKey: ["factures"], queryFn: listFactures });
  const { data: depensesList } = useQuery({ queryKey: ["depenses"], queryFn: () => listDepenses() });
  const { data: commandesList } = useQuery({ queryKey: ["commandes"], queryFn: () => listCommandes() });
  const { data: situationsList } = useQuery({ queryKey: ["situations", id], queryFn: () => listSituations(id) });

  const devisForProject = (devisList ?? []).filter((d) => d.projectId === id);
  const facturesForProject = (facturesList ?? []).filter((f) => f.projectId === id);
  const depensesForProject = (depensesList ?? []).filter((d) => d.projectId === id);
  const commandesForProject = (commandesList ?? []).filter((c) => c.projectId === id);
  const situationsForProject = situationsList ?? [];

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

        <Card className="mb-6">
          <CardHeader><CardTitle>Adresse</CardTitle></CardHeader>
          <CardContent>
            <p>{project.adresse || "—"}{project.codePostal ? ` (${project.codePostal})` : ""}</p>
          </CardContent>
        </Card>

        <h2 className="mb-3 text-lg font-semibold">Suivi financier du chantier</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Devis ({devisForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {devisForProject.map((d) => (
                <Link key={d.id} href={`/devis/${d.id}`} className="flex justify-between text-sm hover:underline">
                  <span>{d.numero} — {DEVIS_STATUT_LABELS[d.statut]}</span>
                  <span>{montantTtc(d.montantHt, d.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                </Link>
              ))}
              {devisForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucun devis lie a ce chantier.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Factures ({facturesForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {facturesForProject.map((f) => (
                <Link key={f.id} href={`/factures/${f.id}`} className="flex justify-between text-sm hover:underline">
                  <span>{f.numero} — {FACTURE_STATUT_LABELS[f.statut]}</span>
                  <span>{montantTtc(f.montantHt, f.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                </Link>
              ))}
              {facturesForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucune facture liee a ce chantier.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Situations de travaux ({situationsForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {situationsForProject.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span>N°{s.numeroSituation} — {SITUATION_STATUT_LABELS[s.statut]}</span>
                  <span>{s.avancementPercent} %</span>
                </div>
              ))}
              {situationsForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucune situation pour ce chantier.</p>}
              <Link href="/situations" className="text-sm text-primary hover:underline">Voir toutes les situations →</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Depenses ({depensesForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {depensesForProject.map((d) => (
                <div key={d.id} className="flex justify-between text-sm">
                  <span>{d.fournisseur} — {DEPENSE_STATUT_LABELS[d.statut]}</span>
                  <span>{montantTtc(d.montantHt, d.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                </div>
              ))}
              {depensesForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucune depense liee a ce chantier.</p>}
              <Link href="/depenses" className="text-sm text-primary hover:underline">Voir toutes les depenses →</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Commandes ({commandesForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {commandesForProject.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span>{c.fournisseur} — {COMMANDE_STATUT_LABELS[c.statut]}</span>
                  <span>{montantTtc(c.montantHt, c.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                </div>
              ))}
              {commandesForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande liee a ce chantier.</p>}
              <Link href="/commandes" className="text-sm text-primary hover:underline">Voir toutes les commandes →</Link>
            </CardContent>
          </Card>
        </div>
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
