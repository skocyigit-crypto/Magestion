import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listProjects } from "@/lib/projects";
import {
  STATUT_LABELS,
  createSituation,
  listSituations,
  updateSituation,
  validerSituation,
  type Situation,
  type SituationInput,
} from "@/lib/situations";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export default function SituationsPage() {
  const queryClient = useQueryClient();
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [projectId, setProjectId] = useState<string>("");
  useEffect(() => {
    if (!projectId && projects && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const { data: situations, isLoading } = useQuery({
    queryKey: ["situations", projectId],
    queryFn: () => listSituations(projectId),
    enabled: !!projectId,
  });

  const EMPTY_FORM: Omit<SituationInput, "projectId"> = {
    marcheHt: 0,
    avancementPercent: 0,
    tauxTva: 20,
    tauxRetenueGarantie: 5,
  };

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<SituationInput, "projectId">>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = situations ?? [];
  const dernierAvancement = all.length > 0 ? Number(all[all.length - 1].avancementPercent) : 0;
  const totalRg = all.reduce((sum, s) => sum + s.montantRetenueGarantie, 0);
  const totalNetPaye = all.filter((s) => s.statut === "VALIDEE").reduce((sum, s) => sum + s.montantNetAPayer, 0);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setIsOpen(true);
  }

  function openEdit(s: Situation) {
    setEditingId(s.id);
    setForm({
      marcheHt: Number(s.marcheHt),
      avancementPercent: Number(s.avancementPercent),
      tauxTva: Number(s.tauxTva) as SituationInput["tauxTva"],
      tauxRetenueGarantie: Number(s.tauxRetenueGarantie),
    });
    setError(null);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateSituation(editingId, form);
      } else {
        await createSituation({ projectId, ...form });
      }
      await queryClient.invalidateQueries({ queryKey: ["situations", projectId] });
      setIsOpen(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleValider(id: string) {
    await validerSituation(id);
    await queryClient.invalidateQueries({ queryKey: ["situations", projectId] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Situations de travaux</h1>
          <Button onClick={openCreate} disabled={!projectId}>Nouvelle situation</Button>
        </div>

        <div className="mb-6 flex flex-col gap-1.5">
          <Label htmlFor="chantier">Chantier</Label>
          <select
            id="chantier"
            className="h-10 max-w-sm rounded-md border border-border bg-transparent px-3 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Nombre de situations</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Avancement actuel</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{dernierAvancement} %</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Retenue de garantie cumulee</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{fmt(totalRg)} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Net paye (validees)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{fmt(totalNetPaye)} €</p></CardContent>
          </Card>
        </div>

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Avancement</th>
                <th className="px-4 py-2">Periode HT</th>
                <th className="px-4 py-2">Periode TTC</th>
                <th className="px-4 py-2">RG</th>
                <th className="px-4 py-2">Net a payer</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {all.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{s.numeroSituation}</td>
                  <td className="px-4 py-2">{s.avancementPercent} %</td>
                  <td className="px-4 py-2">{fmt(s.montantPeriodeHt)} €</td>
                  <td className="px-4 py-2">{fmt(s.montantPeriodeTtc)} €</td>
                  <td className="px-4 py-2">{fmt(s.montantRetenueGarantie)} €</td>
                  <td className="px-4 py-2 font-medium">{fmt(s.montantNetAPayer)} €</td>
                  <td className="px-4 py-2">{STATUT_LABELS[s.statut]}</td>
                  <td className="px-4 py-2">
                    {s.statut === "BROUILLON" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Modifier</Button>
                        <Button size="sm" variant="outline" onClick={() => handleValider(s.id)}>Valider</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && all.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Aucune situation pour ce chantier.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingId ? "Modifier la situation" : `Nouvelle situation (n°${all.length + 1})`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marcheHt">Montant du marche (€ HT)</Label>
            <Input
              id="marcheHt"
              type="number"
              min={0}
              value={form.marcheHt}
              onChange={(e) => setForm({ ...form, marcheHt: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="avancement">Avancement cumule (%)</Label>
            <Input
              id="avancement"
              type="number"
              min={0}
              max={100}
              value={form.avancementPercent}
              onChange={(e) => setForm({ ...form, avancementPercent: Number(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tauxTva">TVA</Label>
              <select
                id="tauxTva"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.tauxTva}
                onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) as SituationInput["tauxTva"] })}
              >
                {[0, 5.5, 10, 20].map((taux) => (
                  <option key={taux} value={taux}>{taux} %</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tauxRg">Retenue de garantie (%)</Label>
              <Input
                id="tauxRg"
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={form.tauxRetenueGarantie}
                onChange={(e) => setForm({ ...form, tauxRetenueGarantie: Number(e.target.value) })}
              />
            </div>
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
