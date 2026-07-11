import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { montantTtc } from "@/lib/devis";
import {
  NEXT_STATUTS,
  STATUT_LABELS,
  changeCommandeStatut,
  createCommande,
  listCommandes,
  type CommandeInput,
  type CommandeStatut,
} from "@/lib/commandes";

const EMPTY_FORM: CommandeInput = { fournisseur: "", objet: "", montantHt: 0, tauxTva: 20 };

export default function CommandesPage() {
  const queryClient = useQueryClient();
  const { data: commandes } = useQuery({ queryKey: ["commandes"], queryFn: listCommandes });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<CommandeInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = commandes ?? [];
  const enAttenteLivraison = all.filter((c) => c.statut === "CONFIRMEE").length;
  const montantTotalTtc = all.reduce((sum, c) => sum + montantTtc(c.montantHt, c.tauxTva), 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCommande(form);
      await queryClient.invalidateQueries({ queryKey: ["commandes"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: CommandeStatut) {
    await changeCommandeStatut(id, statut as "ENVOYEE" | "CONFIRMEE" | "LIVREE");
    await queryClient.invalidateQueries({ queryKey: ["commandes"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Commandes</h1>
          <Button onClick={() => setIsOpen(true)}>Nouvelle commande</Button>
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

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Fournisseur</th>
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2">Montant TTC</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {all.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
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
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Aucune commande pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Nouvelle commande</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fournisseur">Fournisseur</Label>
            <Input id="fournisseur" required value={form.fournisseur} onChange={(e) => setForm({ ...form, fournisseur: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="objet">Objet</Label>
            <Input id="objet" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
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
            <Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
