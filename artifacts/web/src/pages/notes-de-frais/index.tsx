import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORIE_LABELS,
  NEXT_STATUTS,
  STATUT_LABELS,
  changeNoteFraisStatut,
  createNoteFrais,
  listNotesDeFrais,
  type NoteFrais,
  type NoteFraisCategorie,
  type NoteFraisInput,
} from "@/lib/notesDeFrais";
import { listEmployees } from "@/lib/employees";
import { listProjects } from "@/lib/projects";

const EMPTY_FORM: NoteFraisInput = { employeeId: "", dateDepense: "", motif: "", montant: 0, categorie: "AUTRE" };

export default function NotesDeFraisPage() {
  const queryClient = useQueryClient();
  const { data: notes, isLoading, isError } = useQuery({ queryKey: ["notes-de-frais"], queryFn: () => listNotesDeFrais() });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<NoteFraisInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = notes ?? [];
  const totalEnAttente = all.filter((n) => n.statut === "SOUMISE" || n.statut === "VALIDEE").reduce((s, n) => s + Number(n.montant), 0);

  function employeeLabel(id: string): string {
    const e = (employees ?? []).find((emp) => emp.id === id);
    return e ? `${e.prenom} ${e.nom}` : "?";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createNoteFrais(form);
      await queryClient.invalidateQueries({ queryKey: ["notes-de-frais"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(note: NoteFrais, statut: NoteFrais["statut"]) {
    await changeNoteFraisStatut(note.id, statut);
    await queryClient.invalidateQueries({ queryKey: ["notes-de-frais"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Notes de frais</h1>
          <Button onClick={() => setIsOpen(true)}>Nouvelle note de frais</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En attente de remboursement</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{totalEnAttente.toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="flex flex-col gap-3">
          {all.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium">{employeeLabel(n.employeeId)} — {CATEGORIE_LABELS[n.categorie]}</p>
                  <p className="text-sm text-muted-foreground">{n.dateDepense} — {n.motif}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{Number(n.montant).toLocaleString("fr-FR")} €</span>
                  <span className="text-sm text-muted-foreground">{STATUT_LABELS[n.statut]}</span>
                  {NEXT_STATUTS[n.statut].map((s) => (
                    <Button key={s} size="sm" variant="outline" onClick={() => handleStatutChange(n, s)}>{STATUT_LABELS[s]}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && !isError && all.length === 0 && <p className="text-muted-foreground">Aucune note de frais pour le moment.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Nouvelle note de frais</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employeeId">Employe</Label>
            <select
              id="employeeId"
              required
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            >
              <option value="">—</option>
              {(employees ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.prenom} {emp.nom}</option>
              ))}
            </select>
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
              <Label htmlFor="dateDepense">Date</Label>
              <Input id="dateDepense" type="date" required value={form.dateDepense} onChange={(e) => setForm({ ...form, dateDepense: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categorie">Categorie</Label>
              <select
                id="categorie"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value as NoteFraisCategorie })}
              >
                {Object.entries(CATEGORIE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motif">Motif</Label>
            <Input id="motif" required value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="montant">Montant (€)</Label>
            <Input id="montant" type="number" min={0} required value={form.montant} onChange={(e) => setForm({ ...form, montant: Number(e.target.value) })} />
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
