import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createMouvement,
  createStockItem,
  listStockItems,
  updateStockItem,
  type StockItem,
  type StockItemInput,
} from "@/lib/stock";

const EMPTY_FORM: StockItemInput = { nom: "", unite: "u", seuilAlerte: 0, prixUnitaireHt: 0 };

export default function StockPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["stock", showArchived],
    queryFn: () => listStockItems(showArchived),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StockItemInput>(EMPTY_FORM);
  const [mouvementFor, setMouvementFor] = useState<{ id: string; nom: string } | null>(null);
  const [mouvementType, setMouvementType] = useState<"ENTREE" | "SORTIE">("ENTREE");
  const [mouvementQte, setMouvementQte] = useState(1);
  const [mouvementPrix, setMouvementPrix] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const all = items ?? [];
  const enAlerte = all.filter((i) => i.enAlerte).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((i) => i.nom.toLowerCase().includes(q));
  }, [all, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(item: StockItem) {
    setEditingId(item.id);
    setForm({
      nom: item.nom,
      categorie: item.categorie ?? undefined,
      unite: item.unite,
      seuilAlerte: Number(item.seuilAlerte),
      prixUnitaireHt: Number(item.prixUnitaireHt),
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateStockItem(editingId, form);
      } else {
        await createStockItem(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: StockItem) {
    await updateStockItem(item.id, { active: !item.active });
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
  }

  async function handleMouvement(e: React.FormEvent) {
    e.preventDefault();
    if (!mouvementFor) return;
    setError(null);
    try {
      await createMouvement(mouvementFor.id, mouvementType, mouvementQte, undefined, mouvementType === "ENTREE" && mouvementPrix !== "" ? mouvementPrix : undefined);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      setMouvementFor(null);
      setMouvementQte(1);
      setMouvementPrix("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du mouvement");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Stock & Materiel</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Nouvel article de stock</Button>
          </div>
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

        <Input
          placeholder="Rechercher (nom)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Quantite actuelle</th>
                <th className="px-4 py-2">Seuil alerte</th>
                <th className="px-4 py-2">Cout moyen pondere (CUMP)</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${item.enAlerte ? "text-red-400" : ""} ${item.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2">{item.nom}{item.enAlerte && " ⚠"}</td>
                  <td className="px-4 py-2">{item.quantiteActuelle} {item.unite}</td>
                  <td className="px-4 py-2">{item.seuilAlerte} {item.unite}</td>
                  <td className="px-4 py-2">{Number(item.prixUnitaireHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setMouvementFor({ id: item.id, nom: item.nom })}>
                        Mouvement
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}>Modifier</Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(item)}>
                        {item.active ? "Archiver" : "Reactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun article de stock pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>{editingId ? "Modifier l'article de stock" : "Nouvel article de stock"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categorie">Categorie</Label>
              <Input id="categorie" value={form.categorie ?? ""} onChange={(e) => setForm({ ...form, categorie: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prixUnitaireHt">Prix unitaire HT (€)</Label>
              <Input
                id="prixUnitaireHt"
                type="number"
                min={0}
                step="0.01"
                value={form.prixUnitaireHt}
                onChange={(e) => setForm({ ...form, prixUnitaireHt: Number(e.target.value) })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Creer"}</Button>
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
          {mouvementType === "ENTREE" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mvtPrix">Prix d'achat unitaire HT (€, optionnel)</Label>
              <Input
                id="mvtPrix"
                type="number"
                min={0}
                step="0.01"
                value={mouvementPrix}
                onChange={(e) => setMouvementPrix(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Recalcule le cout moyen pondere (CUMP) si renseigne"
              />
            </div>
          )}
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
