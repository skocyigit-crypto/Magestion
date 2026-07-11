import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createMouvement, createStockItem, listStockItems, type StockItemInput } from "@/lib/stock";

const EMPTY_FORM: StockItemInput = { nom: "", unite: "u", seuilAlerte: 0, prixUnitaireHt: 0 };

export default function StockPage() {
  const queryClient = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["stock"], queryFn: listStockItems });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<StockItemInput>(EMPTY_FORM);
  const [mouvementFor, setMouvementFor] = useState<{ id: string; nom: string } | null>(null);
  const [mouvementType, setMouvementType] = useState<"ENTREE" | "SORTIE">("ENTREE");
  const [mouvementQte, setMouvementQte] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = items ?? [];
  const enAlerte = all.filter((i) => i.enAlerte).length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createStockItem(form);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  async function handleMouvement(e: React.FormEvent) {
    e.preventDefault();
    if (!mouvementFor) return;
    setError(null);
    try {
      await createMouvement(mouvementFor.id, mouvementType, mouvementQte);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      setMouvementFor(null);
      setMouvementQte(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du mouvement");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Stock & Materiel</h1>
          <Button onClick={() => setIsOpen(true)}>Nouvel article de stock</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total articles</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En alerte (sous le seuil)</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${enAlerte > 0 ? "text-red-400" : ""}`}>{enAlerte}</p></CardContent>
          </Card>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Quantite actuelle</th>
                <th className="px-4 py-2">Seuil alerte</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {all.map((item) => (
                <tr key={item.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${item.enAlerte ? "text-red-400" : ""}`}>
                  <td className="px-4 py-2">{item.nom}{item.enAlerte && " ⚠"}</td>
                  <td className="px-4 py-2">{item.quantiteActuelle} {item.unite}</td>
                  <td className="px-4 py-2">{item.seuilAlerte} {item.unite}</td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="outline" onClick={() => setMouvementFor({ id: item.id, nom: item.nom })}>
                      Mouvement
                    </Button>
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Aucun article de stock pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Nouvel article de stock</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unite">Unite</Label>
              <Input id="unite" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seuilAlerte">Seuil d'alerte</Label>
              <Input
                id="seuilAlerte"
                type="number"
                min={0}
                value={form.seuilAlerte}
                onChange={(e) => setForm({ ...form, seuilAlerte: Number(e.target.value) })}
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

      <Dialog open={!!mouvementFor} onClose={() => setMouvementFor(null)}>
        <DialogHeader><DialogTitle>Mouvement — {mouvementFor?.nom}</DialogTitle></DialogHeader>
        <form onSubmit={handleMouvement} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mvtType">Type</Label>
            <select
              id="mvtType"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={mouvementType}
              onChange={(e) => setMouvementType(e.target.value as "ENTREE" | "SORTIE")}
            >
              <option value="ENTREE">Entree</option>
              <option value="SORTIE">Sortie</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mvtQte">Quantite</Label>
            <Input id="mvtQte" type="number" min={0.01} step="0.01" value={mouvementQte} onChange={(e) => setMouvementQte(Number(e.target.value))} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMouvementFor(null)}>Annuler</Button>
            <Button type="submit">Valider</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
