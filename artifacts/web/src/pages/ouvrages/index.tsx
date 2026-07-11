import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listArticles } from "@/lib/articles";
import {
  createOuvrage,
  getComposition,
  listOuvrages,
  updateOuvrage,
  type CompositionLine,
  type Ouvrage,
  type OuvrageInput,
} from "@/lib/ouvrages";

const EMPTY_FORM = { code: "", libelle: "", unite: "u", coefficientK: 1.3 };

export default function OuvragesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: ouvrages, isLoading, isError } = useQuery({
    queryKey: ["ouvrages", showArchived],
    queryFn: () => listOuvrages(showArchived),
  });
  const { data: articles } = useQuery({ queryKey: ["articles"], queryFn: () => listArticles() });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [composition, setComposition] = useState<CompositionLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const all = ouvrages ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((o) => o.code.toLowerCase().includes(q) || o.libelle.toLowerCase().includes(q));
  }, [all, search]);
  const margeMoyenne = all.length
    ? all.reduce((sum, o) => {
        const ds = Number(o.debourseSecHt);
        const pv = Number(o.prixVenteHt);
        return sum + (ds > 0 ? ((pv - ds) / pv) * 100 : 0);
      }, 0) / all.length
    : null;

  // Previsualisation live (le calcul definitif reste toujours server-side a la creation).
  const debourseSecPreview = useMemo(() => {
    return composition.reduce((sum, line) => {
      const art = (articles ?? []).find((a) => a.id === line.articleId);
      return sum + (art ? Number(art.prixUnitaireHt) * line.quantite : 0);
    }, 0);
  }, [composition, articles]);
  const prixVentePreview = debourseSecPreview * form.coefficientK;

  function addLigne() {
    if (!articles || articles.length === 0) return;
    setComposition([...composition, { articleId: articles[0].id, quantite: 1 }]);
  }

  function updateLigne(i: number, patch: Partial<CompositionLine>) {
    setComposition(composition.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLigne(i: number) {
    setComposition(composition.filter((_, idx) => idx !== i));
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setComposition([]);
    setError(null);
    setIsOpen(true);
  }

  async function openEdit(ouvrage: Ouvrage) {
    setEditingId(ouvrage.id);
    setForm({
      code: ouvrage.code,
      libelle: ouvrage.libelle,
      unite: ouvrage.unite,
      coefficientK: Number(ouvrage.coefficientK),
    });
    setError(null);
    setIsOpen(true);
    const lignes = await getComposition(ouvrage.id);
    setComposition(lignes.map((l) => ({ articleId: l.articleId, quantite: Number(l.quantite) })));
  }

  async function handleToggleActive(ouvrage: Ouvrage) {
    await updateOuvrage(ouvrage.id, { active: !ouvrage.active });
    await queryClient.invalidateQueries({ queryKey: ["ouvrages"] });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (composition.length === 0) {
      setError("Ajoutez au moins un article a la composition");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: OuvrageInput = { ...form, composition };
      if (editingId) {
        await updateOuvrage(editingId, input);
      } else {
        await createOuvrage(input);
      }
      await queryClient.invalidateQueries({ queryKey: ["ouvrages"] });
      setIsOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setComposition([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Ouvrages — Bibliotheque</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate} disabled={(articles ?? []).length === 0}>Nouvel ouvrage</Button>
          </div>
        </div>
        {(articles ?? []).length === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">Creez d'abord des articles pour pouvoir composer un ouvrage.</p>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total ouvrages</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Marge moyenne</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{margeMoyenne !== null ? `${margeMoyenne.toFixed(1)} %` : "—"}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (code, libelle)..."
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
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Libelle</th>
                <th className="px-4 py-2">Debourse sec HT</th>
                <th className="px-4 py-2">Coeff. K</th>
                <th className="px-4 py-2">Prix de vente HT</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${o.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2">{o.code}</td>
                  <td className="px-4 py-2">{o.libelle}</td>
                  <td className="px-4 py-2">{Number(o.debourseSecHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">{o.coefficientK}</td>
                  <td className="px-4 py-2 font-medium">{Number(o.prixVenteHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(o)}>Modifier</Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(o)}>
                        {o.active ? "Archiver" : "Reactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun ouvrage pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingId ? "Modifier l'ouvrage" : "Nouvel ouvrage"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unite">Unite</Label>
              <Input id="unite" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coefficientK">Coefficient K</Label>
              <Input
                id="coefficientK"
                type="number"
                min={1}
                max={3}
                step="0.01"
                value={form.coefficientK}
                onChange={(e) => setForm({ ...form, coefficientK: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="libelle">Libelle</Label>
            <Input id="libelle" required value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Composition (sous-detail)</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLigne}>+ Ajouter un article</Button>
            </div>
            {composition.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="h-9 flex-1 rounded-md border border-border bg-transparent px-2 text-sm"
                  value={line.articleId}
                  onChange={(e) => updateLigne(i, { articleId: e.target.value })}
                >
                  {(articles ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.libelle} ({Number(a.prixUnitaireHt).toFixed(2)} €/{a.unite})</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={0.001}
                  step="0.001"
                  className="w-24"
                  value={line.quantite}
                  onChange={(e) => updateLigne(i, { quantite: Number(e.target.value) })}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => removeLigne(i)}>Retirer</Button>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
            <p>Debourse sec HT (previsualisation) : <strong>{debourseSecPreview.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</strong></p>
            <p>Prix de vente HT (= debourse sec × K) : <strong>{prixVentePreview.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</strong></p>
            <p className="text-xs text-muted-foreground">Calcul definitif recalcule server-side a la creation.</p>
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
