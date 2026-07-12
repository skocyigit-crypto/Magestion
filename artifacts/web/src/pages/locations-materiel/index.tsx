import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  STATUT_LABELS,
  createLocationMateriel,
  listLocationsMateriel,
  updateLocationMateriel,
  type LocationMateriel,
  type LocationMaterielInput,
} from "@/lib/locationsMateriel";
import { listProjects } from "@/lib/projects";

const EMPTY_FORM: LocationMaterielInput = { designation: "", fournisseur: "", dateDebut: "", coutJournalierHt: 0 };

function joursLocation(dateDebut: string, dateFin: string | null): number {
  const fin = dateFin ? new Date(dateFin) : new Date();
  return Math.max(1, Math.ceil((fin.getTime() - new Date(dateDebut).getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

export default function LocationsMaterielPage() {
  const queryClient = useQueryClient();
  const { data: locations, isLoading, isError } = useQuery({ queryKey: ["locations-materiel"], queryFn: () => listLocationsMateriel() });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<LocationMaterielInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = locations ?? [];
  const enCours = all.filter((l) => l.statut === "EN_COURS");
  const coutTotalEnCours = enCours.reduce((s, l) => s + Number(l.coutJournalierHt) * joursLocation(l.dateDebut, l.dateFin), 0);

  function projectLabel(id: string | null): string {
    if (!id) return "—";
    return (projects ?? []).find((p) => p.id === id)?.nom ?? "?";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createLocationMateriel(form);
      await queryClient.invalidateQueries({ queryKey: ["locations-materiel"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleTerminer(l: LocationMateriel) {
    await updateLocationMateriel(l.id, { statut: "TERMINEE", dateFin: new Date().toISOString().slice(0, 10) });
    await queryClient.invalidateQueries({ queryKey: ["locations-materiel"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Locations de materiel</h1>
          <Button onClick={() => setIsOpen(true)}>Nouvelle location</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>En cours</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{enCours.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cout cumule (en cours, HT)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{coutTotalEnCours.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</p></CardContent>
          </Card>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="flex flex-col gap-3">
          {all.map((l) => (
            <Card key={l.id} className={l.statut === "TERMINEE" ? "opacity-60" : undefined}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium">{l.designation} — {l.fournisseur}</p>
                  <p className="text-sm text-muted-foreground">
                    {projectLabel(l.projectId)} — du {l.dateDebut} {l.dateFin ? `au ${l.dateFin}` : "(en cours)"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{Number(l.coutJournalierHt).toLocaleString("fr-FR")} €/jour</span>
                  <span className="text-sm text-muted-foreground">{STATUT_LABELS[l.statut]}</span>
                  {l.statut === "EN_COURS" && <Button size="sm" variant="outline" onClick={() => handleTerminer(l)}>Terminer</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && !isError && all.length === 0 && <p className="text-muted-foreground">Aucune location pour le moment.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Nouvelle location de materiel</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="designation">Materiel</Label>
            <Input id="designation" required value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fournisseur">Fournisseur</Label>
            <Input id="fournisseur" required value={form.fournisseur} onChange={(e) => setForm({ ...form, fournisseur: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectId">Chantier (optionnel)</Label>
            <select
              id="projectId"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.projectId ?? ""}
              onChange={(e) => setForm({ ...form, projectId: e.target.value || undefined })}
            >
              <option value="">—</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateDebut">Date de debut</Label>
              <Input id="dateDebut" type="date" required value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coutJournalierHt">Cout journalier HT (€)</Label>
              <Input id="coutJournalierHt" type="number" min={0} required value={form.coutJournalierHt} onChange={(e) => setForm({ ...form, coutJournalierHt: Number(e.target.value) })} />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
