import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORIE_LABELS, createArticle, listArticles, type ArticleCategorie, type ArticleInput } from "@/lib/articles";

const EMPTY_FORM: ArticleInput = { code: "", libelle: "", unite: "u", categorie: "DIVERS", prixUnitaireHt: 0 };

export default function ArticlesPage() {
  const queryClient = useQueryClient();
  const { data: articles } = useQuery({ queryKey: ["articles"], queryFn: listArticles });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ArticleInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = articles ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createArticle(form);
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
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
          <h1 className="text-2xl font-semibold">Articles — Bibliotheque</h1>
          <Button onClick={() => setIsOpen(true)}>Nouvel article</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total articles</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Libelle</th>
                <th className="px-4 py-2">Categorie</th>
                <th className="px-4 py-2">Unite</th>
                <th className="px-4 py-2">Prix unitaire HT</th>
              </tr>
            </thead>
            <tbody>
              {all.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{a.code}</td>
                  <td className="px-4 py-2">{a.libelle}</td>
                  <td className="px-4 py-2">{CATEGORIE_LABELS[a.categorie]}</td>
                  <td className="px-4 py-2">{a.unite}</td>
                  <td className="px-4 py-2">{Number(a.prixUnitaireHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun article pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Nouvel article</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unite">Unite</Label>
              <Input id="unite" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="libelle">Libelle</Label>
            <Input id="libelle" required value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categorie">Categorie</Label>
              <select
                id="categorie"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value as ArticleCategorie })}
              >
                {Object.entries(CATEGORIE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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
            <Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
