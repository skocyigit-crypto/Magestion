import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listArticles } from "@/lib/articles";
import { createOuvrage, listOuvrages, type CompositionLine, type OuvrageInput } from "@/lib/ouvrages";

const EMPTY_FORM = { code: "", libelle: "", unite: "u", coefficientK: 1.3 };

export default function OuvragesPage() {
  const queryClient = useQueryClient();
  const { data: ouvrages } = useQuery({ queryKey: ["ouvrages"], queryFn: listOuvrages });
  const { data: articles } = useQuery({ queryKey: ["articles"], queryFn: listArticles });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [composition, setComposition] = useState<CompositionLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = ouvrages ?? [];
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (composition.length === 0) {
      setError("Ajoutez au moins un article a la composition");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: OuvrageInput = { ...form, composition };
      await createOuvrage(input);
      await queryClient.invalidateQueries({ queryKey: ["ouvrages"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setComposition([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Ouvrages — Bibliotheque</h1>
          <Button onClick={() => setIsOpen(true)} disabled={(articles ?? []).length === 0}>Nouvel ouvrage</Button>
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

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Libelle</th>
                <th className="px-4 py-2">Debourse sec HT</th>
                <th className="px-4 py-2">Coeff. K</th>
                <th className="px-4 py-2">Prix de vente HT</th>
              </tr>
            </thead>
            <tbody>
              {all.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{o.code}</td>
                  <td className="px-4 py-2">{o.libelle}</td>
                  <td className="px-4 py-2">{Number(o.debourseSecHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">{o.coefficientK}</td>
                  <td className="px-4 py-2 font-medium">{Number(o.prixVenteHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun ouvrage pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvel ouvrage</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
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
            <Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
