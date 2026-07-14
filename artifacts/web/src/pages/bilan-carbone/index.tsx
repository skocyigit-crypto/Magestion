import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORIE_LABELS,
  MATERIAU_CATEGORIE_LABELS,
  PRESETS_EMISSION,
  createBilanCarbone,
  listBilanCarbone,
  listMateriauxInies,
  type BilanCarboneInput,
  type CategorieCarbone,
  type MateriauInies,
} from "@/lib/bilanCarbone";
import { listProjects } from "@/lib/projects";

const EMPTY_FORM: BilanCarboneInput = {
  projectId: "",
  categorie: "MATERIAUX",
  materiauIniesId: undefined,
  poste: "",
  quantite: 0,
  unite: "",
  facteurEmissionKgCo2: 0,
  dateOperation: "",
};

export default function BilanCarbonePage() {
  const queryClient = useQueryClient();
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: materiauxInies } = useQuery({ queryKey: ["materiaux-inies"], queryFn: listMateriauxInies });
  const [projectFilter, setProjectFilter] = useState("");
  const { data: lignes, isLoading, isError } = useQuery({
    queryKey: ["bilan-carbone", projectFilter],
    queryFn: () => listBilanCarbone(projectFilter || undefined),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<BilanCarboneInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = lignes ?? [];
  const projectNom = (id: string) => (projects ?? []).find((p) => p.id === id)?.nom ?? "—";

  const totalKgCo2 = useMemo(() => all.reduce((s, l) => s + Number(l.emissionsKgCo2), 0), [all]);
  const totauxParCategorie = useMemo(() => {
    const totals: Record<CategorieCarbone, number> = { TRANSPORT: 0, MATERIAUX: 0, ENERGIE: 0, DECHETS: 0, AUTRE: 0 };
    for (const l of all) totals[l.categorie] += Number(l.emissionsKgCo2);
    return totals;
  }, [all]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, projectId: projectFilter || "" });
    setError(null);
    setIsOpen(true);
  }

  function applyPreset(label: string) {
    const preset = PRESETS_EMISSION.find((p) => p.label === label);
    if (!preset) return;
    setForm({ ...form, materiauIniesId: undefined, categorie: preset.categorie, poste: preset.poste, unite: preset.unite, facteurEmissionKgCo2: preset.facteur });
  }

  function applyMateriau(id: string) {
    const materiau = (materiauxInies ?? []).find((m) => m.id === id);
    if (!materiau) {
      setForm({ ...form, materiauIniesId: undefined });
      return;
    }
    setForm({
      ...form,
      materiauIniesId: materiau.id,
      categorie: "MATERIAUX",
      poste: materiau.designation,
      unite: materiau.uniteFonctionnelle,
      facteurEmissionKgCo2: Number(materiau.emissionCo2Kg),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createBilanCarbone(form);
      await queryClient.invalidateQueries({ queryKey: ["bilan-carbone"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const emissionsPreview = form.quantite * form.facteurEmissionKgCo2;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Bilan carbone</h1>
          <Button onClick={openCreate}>Ajouter un poste d'emission</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total emissions</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{(totalKgCo2 / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} t CO2e</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Materiaux</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{(totauxParCategorie.MATERIAUX / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} t CO2e</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Transport</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{(totauxParCategorie.TRANSPORT / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} t CO2e</p></CardContent>
          </Card>
        </div>

        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor="projectFilter" className="text-xs text-muted-foreground">Filtrer par chantier</label>
          <select
            id="projectFilter"
            className="h-10 w-64 rounded-md border border-border bg-transparent px-3 text-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">Tous les chantiers</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Chantier</th>
                <th className="px-4 py-2">Categorie</th>
                <th className="px-4 py-2">Poste</th>
                <th className="px-4 py-2 text-right">Quantite</th>
                <th className="px-4 py-2 text-right">Emissions</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {all.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{projectNom(l.projectId)}</td>
                  <td className="px-4 py-2">{CATEGORIE_LABELS[l.categorie]}</td>
                  <td className="px-4 py-2">{l.poste}</td>
                  <td className="px-4 py-2 text-right">{Number(l.quantite).toLocaleString("fr-FR")} {l.unite}</td>
                  <td className="px-4 py-2 text-right font-medium">{Number(l.emissionsKgCo2).toLocaleString("fr-FR")} kg CO2e</td>
                  <td className="px-4 py-2">{new Date(l.dateOperation).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
              {!isLoading && !isError && all.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun poste d'emission enregistre pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Facteurs d'emission indicatifs (ordre de grandeur ADEME) — ajustez-les selon vos donnees reelles pour un reporting engageant.
        </p>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Ajouter un poste d'emission</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectId">Chantier</Label>
            <select
              id="projectId"
              required
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">Selectionner...</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="materiau">Materiau (bibliotheque INIES, optionnel)</Label>
            <select
              id="materiau"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.materiauIniesId ?? ""}
              onChange={(e) => applyMateriau(e.target.value)}
            >
              <option value="">— Aucun —</option>
              {Object.entries(
                (materiauxInies ?? []).reduce<Record<string, MateriauInies[]>>((groups, m) => {
                  (groups[m.categorie] ??= []).push(m);
                  return groups;
                }, {}),
              ).map(([categorie, items]) => (
                <optgroup key={categorie} label={MATERIAU_CATEGORIE_LABELS[categorie] ?? categorie}>
                  {items.map((m) => (
                    <option key={m.id} value={m.id}>{m.designation} ({m.emissionCo2Kg} kg CO2e/{m.uniteFonctionnelle})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preset">Facteur indicatif rapide (transport/energie/dechets)</Label>
            <select
              id="preset"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              defaultValue=""
              onChange={(e) => applyPreset(e.target.value)}
            >
              <option value="">— Saisie libre —</option>
              {PRESETS_EMISSION.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categorie">Categorie</Label>
              <select
                id="categorie"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value as CategorieCarbone })}
              >
                {Object.entries(CATEGORIE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="poste">Poste</Label>
              <Input id="poste" required readOnly={!!form.materiauIniesId} value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} />
            </div>
          </div>

          {form.materiauIniesId && (
            <p className="text-xs text-muted-foreground">
              Unite et facteur d'emission verrouilles sur la valeur de reference du materiau — selectionnez « Aucun » ci-dessus pour saisir librement.
            </p>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantite">Quantite</Label>
              <Input id="quantite" type="number" min={0} step="0.01" required value={form.quantite} onChange={(e) => setForm({ ...form, quantite: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unite">Unite</Label>
              <Input id="unite" required readOnly={!!form.materiauIniesId} placeholder="km, t, kWh, L..." value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="facteur">Facteur (kg CO2e/unite)</Label>
              <Input id="facteur" type="number" min={0} step="0.0001" required readOnly={!!form.materiauIniesId} value={form.facteurEmissionKgCo2} onChange={(e) => setForm({ ...form, facteurEmissionKgCo2: Number(e.target.value) })} />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Emissions estimees : <span className="font-semibold text-foreground">{emissionsPreview.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg CO2e</span>
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateOperation">Date</Label>
            <Input id="dateOperation" type="date" required value={form.dateOperation} onChange={(e) => setForm({ ...form, dateOperation: e.target.value })} />
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
