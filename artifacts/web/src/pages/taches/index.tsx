import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listProjects } from "@/lib/projects";
import { listEmployees } from "@/lib/employees";
import {
  PRIORITE_LABELS,
  STATUT_LABELS,
  createTache,
  listTaches,
  updateTache,
  type Tache,
  type TacheInput,
  type TachePriorite,
  type TacheStatut,
} from "@/lib/taches";

const COLONNES: TacheStatut[] = ["A_FAIRE", "EN_COURS", "TERMINEE", "ANNULEE"];
const EMPTY_FORM: TacheInput = { titre: "", priorite: "NORMALE" };

const PRIORITE_COLOR: Record<TachePriorite, string> = {
  BASSE: "text-muted-foreground",
  NORMALE: "text-blue-400",
  HAUTE: "text-orange-400",
  URGENTE: "text-red-400",
};

export default function TachesPage() {
  const queryClient = useQueryClient();
  const { data: taches, isLoading, isError } = useQuery({ queryKey: ["taches"], queryFn: () => listTaches() });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<TacheInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = taches ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const enRetard = all.filter((t) => t.echeance && t.echeance < today && t.statut !== "TERMINEE" && t.statut !== "ANNULEE").length;

  const byStatut = useMemo(() => {
    const groups: Record<TacheStatut, Tache[]> = { A_FAIRE: [], EN_COURS: [], TERMINEE: [], ANNULEE: [] };
    for (const t of all) groups[t.statut].push(t);
    return groups;
  }, [all]);

  function nomEmploye(id: string | null): string | null {
    if (!id) return null;
    const e = (employees ?? []).find((emp) => emp.id === id);
    return e ? `${e.prenom} ${e.nom}` : null;
  }

  function nomProjet(id: string | null): string | null {
    if (!id) return null;
    return (projects ?? []).find((p) => p.id === id)?.nom ?? null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createTache(form);
      await queryClient.invalidateQueries({ queryKey: ["taches"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: TacheStatut) {
    await updateTache(id, { statut });
    await queryClient.invalidateQueries({ queryKey: ["taches"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Taches</h1>
          <Button onClick={() => setIsOpen(true)}>Nouvelle tache</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total taches</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En cours</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{byStatut.EN_COURS.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En retard</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${enRetard > 0 ? "text-red-400" : ""}`}>{enRetard}</p></CardContent>
          </Card>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {COLONNES.map((statut) => (
            <div key={statut} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-muted-foreground">{STATUT_LABELS[statut]} ({byStatut[statut].length})</p>
              <div className="flex flex-col gap-2">
                {byStatut[statut].map((t) => {
                  const enRetardCard = t.echeance && t.echeance < today && t.statut !== "TERMINEE" && t.statut !== "ANNULEE";
                  return (
                    <Card key={t.id} className={enRetardCard ? "border-red-900/50" : ""}>
                      <CardContent className="flex flex-col gap-1.5 pt-4 text-sm">
                        <p className="font-medium">{t.titre}</p>
                        <p className={`text-xs ${PRIORITE_COLOR[t.priorite]}`}>{PRIORITE_LABELS[t.priorite]}</p>
                        {nomProjet(t.projectId) && <p className="text-xs text-muted-foreground">{nomProjet(t.projectId)}</p>}
                        {nomEmploye(t.assigneId) && <p className="text-xs text-muted-foreground">{nomEmploye(t.assigneId)}</p>}
                        {t.echeance && <p className={`text-xs ${enRetardCard ? "text-red-400" : "text-muted-foreground"}`}>Echeance : {t.echeance}</p>}
                        <select
                          className="mt-1 h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                          value={t.statut}
                          onChange={(e) => handleStatutChange(t.id, e.target.value as TacheStatut)}
                        >
                          {COLONNES.map((s) => (
                            <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                          ))}
                        </select>
                      </CardContent>
                    </Card>
                  );
                })}
                {byStatut[statut].length === 0 && <p className="text-xs text-muted-foreground">Aucune tache.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Nouvelle tache</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titre">Titre</Label>
            <Input id="titre" required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Input id="description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priorite">Priorite</Label>
              <select
                id="priorite"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.priorite ?? "NORMALE"}
                onChange={(e) => setForm({ ...form, priorite: e.target.value as TachePriorite })}
              >
                {Object.entries(PRIORITE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="echeance">Echeance (optionnel)</Label>
              <Input id="echeance" type="date" value={form.echeance ?? ""} onChange={(e) => setForm({ ...form, echeance: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigneId">Assigne a (optionnel)</Label>
              <select
                id="assigneId"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.assigneId ?? ""}
                onChange={(e) => setForm({ ...form, assigneId: e.target.value || undefined })}
              >
                <option value="">—</option>
                {(employees ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
                ))}
              </select>
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
