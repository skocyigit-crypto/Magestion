import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DESTINATION_LABELS,
  TYPE_DECHET_LABELS,
  createDechetChantier,
  listDechetsChantier,
  type DechetChantierInput,
  type DestinationDechet,
  type TypeDechet,
} from "@/lib/gestionDechets";
import { listProjects } from "@/lib/projects";

const EMPTY_FORM: DechetChantierInput = {
  projectId: "",
  typeDechet: "INERTES",
  natureDechet: "",
  quantite: 0,
  dateEnlevement: "",
};

export default function GestionDechetsPage() {
  const queryClient = useQueryClient();
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [projectFilter, setProjectFilter] = useState("");
  const { data: dechets, isLoading, isError } = useQuery({
    queryKey: ["gestion-dechets", projectFilter],
    queryFn: () => listDechetsChantier(projectFilter || undefined),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<DechetChantierInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = dechets ?? [];
  const projectNom = (id: string) => (projects ?? []).find((p) => p.id === id)?.nom ?? "—";

  const totauxParType = useMemo(() => {
    const totals: Record<TypeDechet, number> = { INERTES: 0, NON_DANGEREUX_NON_INERTES: 0, DANGEREUX: 0 };
    for (const d of all) totals[d.typeDechet] += Number(d.quantite);
    return totals;
  }, [all]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, projectId: projectFilter || "" });
    setError(null);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDechetChantier(form);
      await queryClient.invalidateQueries({ queryKey: ["gestion-dechets"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Gestion des dechets</h1>
          <Button onClick={openCreate}>Enregistrer un enlevement</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Inertes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{totauxParType.INERTES.toLocaleString("fr-FR")} t</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Non dangereux non inertes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{totauxParType.NON_DANGEREUX_NON_INERTES.toLocaleString("fr-FR")} t</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Dangereux</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${totauxParType.DANGEREUX > 0 ? "text-orange-400" : ""}`}>{totauxParType.DANGEREUX.toLocaleString("fr-FR")} t</p></CardContent>
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
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Nature</th>
                <th className="px-4 py-2 text-right">Quantite</th>
                <th className="px-4 py-2">Destination</th>
                <th className="px-4 py-2">Date enlevement</th>
                <th className="px-4 py-2">Bordereau</th>
              </tr>
            </thead>
            <tbody>
              {all.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{projectNom(d.projectId)}</td>
                  <td className="px-4 py-2">{TYPE_DECHET_LABELS[d.typeDechet]}</td>
                  <td className="px-4 py-2">{d.natureDechet}</td>
                  <td className="px-4 py-2 text-right">{Number(d.quantite).toLocaleString("fr-FR")} {d.unite}</td>
                  <td className="px-4 py-2">{DESTINATION_LABELS[d.destination]}</td>
                  <td className="px-4 py-2">{new Date(d.dateEnlevement).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">{d.bordereauNumero || "—"}</td>
                </tr>
              ))}
              {!isLoading && !isError && all.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Aucun enlevement de dechets pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Le numero de bordereau (BSDD) est obligatoire pour les dechets dangereux (art. R541-45 code de l'environnement).
        </p>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Enregistrer un enlevement de dechets</DialogTitle>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="typeDechet">Type</Label>
              <select
                id="typeDechet"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.typeDechet}
                onChange={(e) => setForm({ ...form, typeDechet: e.target.value as TypeDechet })}
              >
                {Object.entries(TYPE_DECHET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="natureDechet">Nature</Label>
              <Input id="natureDechet" required placeholder="Beton, bois, metaux..." value={form.natureDechet} onChange={(e) => setForm({ ...form, natureDechet: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantite">Quantite (tonnes)</Label>
              <Input id="quantite" type="number" min={0} step="0.01" required value={form.quantite} onChange={(e) => setForm({ ...form, quantite: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateEnlevement">Date d'enlevement</Label>
              <Input id="dateEnlevement" type="date" required value={form.dateEnlevement} onChange={(e) => setForm({ ...form, dateEnlevement: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="destination">Destination</Label>
              <select
                id="destination"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.destination ?? "RECYCLAGE"}
                onChange={(e) => setForm({ ...form, destination: e.target.value as DestinationDechet })}
              >
                {Object.entries(DESTINATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collecteur">Collecteur</Label>
              <Input id="collecteur" value={form.collecteur ?? ""} onChange={(e) => setForm({ ...form, collecteur: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bordereauNumero">
              Numero de bordereau (BSDD) {form.typeDechet === "DANGEREUX" && <span className="text-orange-400">— obligatoire</span>}
            </Label>
            <Input id="bordereauNumero" required={form.typeDechet === "DANGEREUX"} value={form.bordereauNumero ?? ""} onChange={(e) => setForm({ ...form, bordereauNumero: e.target.value })} />
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
