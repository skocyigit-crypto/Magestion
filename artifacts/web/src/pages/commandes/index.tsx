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
  NEXT_STATUTS,
  STATUT_LABELS,
  changeCommandeStatut,
  createCommande,
  listCommandes,
  updateCommande,
  type Commande,
  type CommandeInput,
  type CommandeStatut,
} from "@/lib/commandes";

const EMPTY_FORM: CommandeInput = { fournisseur: "", objet: "", montantHt: 0, tauxTva: 20 };

export default function CommandesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: commandes, isLoading } = useQuery({
    queryKey: ["commandes", showArchived],
    queryFn: () => listCommandes(showArchived),
  });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CommandeInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = commandes ?? [];
  const enAttenteLivraison = all.filter((c) => c.statut === "CONFIRMEE").length;
  const montantTotalTtc = all.reduce((sum, c) => sum + montantTtc(c.montantHt, c.tauxTva), 0);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(commande: Commande) {
    setEditingId(commande.id);
    setForm({
      fournisseur: commande.fournisseur,
      objet: commande.objet,
      projectId: commande.projectId ?? undefined,
      montantHt: Number(commande.montantHt),
      tauxTva: Number(commande.tauxTva) as CommandeInput["tauxTva"],
      dateLivraisonPrevue: commande.dateLivraisonPrevue ?? undefined,
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateCommande(editingId, form);
      } else {
        await createCommande(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["commandes"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: CommandeStatut) {
    await changeCommandeStatut(id, statut as "ENVOYEE" | "CONFIRMEE" | "LIVREE");
    await queryClient.invalidateQueries({ queryKey: ["commandes"] });
  }

  async function handleToggleActive(commande: Commande) {
    await updateCommande(commande.id, { active: !commande.active });
    await queryClient.invalidateQueries({ queryKey: ["commandes"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Commandes</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Nouvelle commande</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Total commandes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En attente livraison</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{enAttenteLivraison}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Livrees</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.filter((c) => c.statut === "LIVREE").length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant total TTC</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{montantTotalTtc.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</p></CardContent>
          </Card>
        </div>

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Fournisseur</th>
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2">Montant TTC</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {all.map((c) => (
                <tr key={c.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${c.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2">{c.fournisseur}</td>
                  <td className="px-4 py-2">{c.objet}</td>
                  <td className="px-4 py-2">{montantTtc(c.montantHt, c.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">
                    {NEXT_STATUTS[c.statut].length > 0 ? (
                      <select
                        className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                        value={c.statut}
                        onChange={(e) => handleStatutChange(c.id, e.target.value as CommandeStatut)}
                      >
                        <option value={c.statut}>{STATUT_LABELS[c.statut]}</option>
                        {NEXT_STATUTS[c.statut].map((s) => (
                          <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                        ))}
                      </select>
                    ) : (
                      STATUT_LABELS[c.statut]
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Modifier</Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(c)}>
                        {c.active ? "Archiver" : "Reactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && all.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune commande pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingId ? "Modifier la commande" : "Nouvelle commande"}</DialogTitle>
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
                onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) as CommandeInput["tauxTva"] })}
              >
                {[0, 5.5, 10, 20].map((taux) => (
                  <option key={taux} value={taux}>{taux} %</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateLivraisonPrevue">Date de livraison prevue</Label>
            <Input
              id="dateLivraisonPrevue"
              type="date"
              value={form.dateLivraisonPrevue ?? ""}
              onChange={(e) => setForm({ ...form, dateLivraisonPrevue: e.target.value })}
            />
          </div>
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
