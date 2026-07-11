import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { montantTtc } from "@/lib/devis";
import { listProjects } from "@/lib/projects";
import {
  CATEGORIE_LABELS,
  NEXT_STATUTS,
  STATUT_LABELS,
  changeDepenseStatut,
  createDepense,
  listDepenses,
  updateDepense,
  type Depense,
  type DepenseCategorie,
  type DepenseInput,
  type DepenseStatut,
} from "@/lib/depenses";

const EMPTY_FORM: DepenseInput = { fournisseur: "", objet: "", montantHt: 0, tauxTva: 20, categorie: "AUTRE", autoliquidation: false };

export default function DepensesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: depenses } = useQuery({
    queryKey: ["depenses", showArchived],
    queryFn: () => listDepenses(showArchived),
  });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DepenseInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = depenses ?? [];
  const totalTtc = all.reduce((sum, d) => sum + montantTtc(d.montantHt, d.tauxTva), 0);
  const aValider = all.filter((d) => d.statut === "A_VALIDER").length;
  const enLitige = all.filter((d) => d.statut === "EN_LITIGE").length;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(depense: Depense) {
    setEditingId(depense.id);
    setForm({
      fournisseur: depense.fournisseur,
      objet: depense.objet,
      projectId: depense.projectId ?? undefined,
      montantHt: Number(depense.montantHt),
      tauxTva: Number(depense.tauxTva) as DepenseInput["tauxTva"],
      categorie: depense.categorie,
      autoliquidation: depense.autoliquidation,
      dateEcheance: depense.dateEcheance ?? undefined,
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateDepense(editingId, form);
      } else {
        await createDepense(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["depenses"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: DepenseStatut) {
    await changeDepenseStatut(id, statut as "BON_A_PAYER" | "PAYEE" | "EN_LITIGE");
    await queryClient.invalidateQueries({ queryKey: ["depenses"] });
  }

  async function handleToggleActive(depense: Depense) {
    await updateDepense(depense.id, { active: !depense.active });
    await queryClient.invalidateQueries({ queryKey: ["depenses"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Depenses — Factures fournisseurs</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Nouvelle depense</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Total depenses</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant total TTC</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{totalTtc.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>A valider</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{aValider}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En litige</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{enLitige}</p></CardContent>
          </Card>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Fournisseur</th>
                <th className="px-4 py-2">Categorie</th>
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2">Montant TTC</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {all.map((d) => (
                <tr key={d.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${d.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2">
                    {d.fournisseur}
                    {d.autoliquidation && <span className="ml-2 text-xs text-primary">(autoliq.)</span>}
                  </td>
                  <td className="px-4 py-2">{CATEGORIE_LABELS[d.categorie]}</td>
                  <td className="px-4 py-2">{d.objet}</td>
                  <td className="px-4 py-2">{montantTtc(d.montantHt, d.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">
                    {NEXT_STATUTS[d.statut].length > 0 ? (
                      <select
                        className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                        value={d.statut}
                        onChange={(e) => handleStatutChange(d.id, e.target.value as DepenseStatut)}
                      >
                        <option value={d.statut}>{STATUT_LABELS[d.statut]}</option>
                        {NEXT_STATUTS[d.statut].map((s) => (
                          <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                        ))}
                      </select>
                    ) : (
                      STATUT_LABELS[d.statut]
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(d)}>Modifier</Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(d)}>
                        {d.active ? "Archiver" : "Reactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucune depense pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingId ? "Modifier la depense" : "Nouvelle depense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fournisseur">Fournisseur</Label>
            <Input id="fournisseur" required value={form.fournisseur} onChange={(e) => setForm({ ...form, fournisseur: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="objet">Objet</Label>
            <Input id="objet" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
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
              <Label htmlFor="montantHt">Montant HT (€)</Label>
              <Input
                id="montantHt"
                type="number"
                min={0}
                value={form.montantHt}
                onChange={(e) => setForm({ ...form, montantHt: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tauxTva">TVA</Label>
              <select
                id="tauxTva"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.tauxTva}
                onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) as DepenseInput["tauxTva"] })}
              >
                {[0, 5.5, 10, 20].map((taux) => (
                  <option key={taux} value={taux}>{taux} %</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categorie">Categorie</Label>
            <select
              id="categorie"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value as DepenseCategorie })}
            >
              {Object.entries(CATEGORIE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.autoliquidation ?? false}
              onChange={(e) => setForm({ ...form, autoliquidation: e.target.checked })}
            />
            Autoliquidation TVA (sous-traitance BTP — art. 283-2 nonies CGI)
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
