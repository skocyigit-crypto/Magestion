import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORIE_LABELS,
  createArticle,
  listArticles,
  updateArticle,
  type Article,
  type ArticleCategorie,
  type ArticleInput,
} from "@/lib/articles";
import { listFournisseurs } from "@/lib/fournisseurs";
import {
  listTarifsFournisseurs,
  upsertTarifFournisseur,
  type TarifFournisseurInput,
} from "@/lib/tarifsFournisseurs";

const EMPTY_FORM: ArticleInput = { code: "", libelle: "", unite: "u", categorie: "DIVERS", prixUnitaireHt: 0 };

export default function ArticlesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: articles, isLoading, isError } = useQuery({
    queryKey: ["articles", showArchived],
    queryFn: () => listArticles(showArchived),
  });

  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = articles ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => a.code.toLowerCase().includes(q) || a.libelle.toLowerCase().includes(q));
  }, [all, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(article: Article) {
    setEditingId(article.id);
    setForm({
      code: article.code,
      libelle: article.libelle,
      unite: article.unite,
      categorie: article.categorie,
      prixUnitaireHt: Number(article.prixUnitaireHt),
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateArticle(editingId, form);
      } else {
        await createArticle(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(article: Article) {
    await updateArticle(article.id, { active: !article.active });
    await queryClient.invalidateQueries({ queryKey: ["articles"] });
  }

  const [tarifsArticle, setTarifsArticle] = useState<Article | null>(null);
  const { data: fournisseurs } = useQuery({ queryKey: ["fournisseurs"], queryFn: () => listFournisseurs() });
  const { data: tarifs, isLoading: tarifsLoading } = useQuery({
    queryKey: ["tarifs-fournisseurs", tarifsArticle?.id],
    queryFn: () => listTarifsFournisseurs({ articleId: tarifsArticle!.id }),
    enabled: !!tarifsArticle,
  });
  const EMPTY_TARIF_FORM = { fournisseurId: "", prixUnitaireHt: 0 };
  const [tarifForm, setTarifForm] = useState<Omit<TarifFournisseurInput, "articleId">>(EMPTY_TARIF_FORM);
  const [tarifSaving, setTarifSaving] = useState(false);
  const [tarifError, setTarifError] = useState<string | null>(null);

  const fournisseurNom = (id: string) => (fournisseurs ?? []).find((f) => f.id === id)?.nom ?? "—";

  async function handleAddTarif(e: React.FormEvent) {
    e.preventDefault();
    if (!tarifsArticle) return;
    setTarifSaving(true);
    setTarifError(null);
    try {
      await upsertTarifFournisseur({ articleId: tarifsArticle.id, ...tarifForm });
      await queryClient.invalidateQueries({ queryKey: ["tarifs-fournisseurs", tarifsArticle.id] });
      setTarifForm(EMPTY_TARIF_FORM);
    } catch (err) {
      setTarifError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setTarifSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Articles — Bibliotheque</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Nouvel article</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total articles</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
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
                <th className="px-4 py-2">Categorie</th>
                <th className="px-4 py-2">Unite</th>
                <th className="px-4 py-2">Prix unitaire HT</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${a.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2">{a.code}</td>
                  <td className="px-4 py-2">{a.libelle}</td>
                  <td className="px-4 py-2">{CATEGORIE_LABELS[a.categorie]}</td>
                  <td className="px-4 py-2">{a.unite}</td>
                  <td className="px-4 py-2">{Number(a.prixUnitaireHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(a)}>Modifier</Button>
                      <Button variant="outline" size="sm" onClick={() => setTarifsArticle(a)}>Tarifs fournisseurs</Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(a)}>
                        {a.active ? "Archiver" : "Reactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun article pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingId ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Creer"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!tarifsArticle} onClose={() => setTarifsArticle(null)}>
        <DialogHeader>
          <DialogTitle>Tarifs fournisseurs — {tarifsArticle?.libelle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Trie par prix croissant — la premiere ligne est le fournisseur le moins cher pour cet article.
          </p>
          {tarifsLoading && <p className="text-muted-foreground">Chargement...</p>}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-2">Fournisseur</th>
                  <th className="px-3 py-2 text-right">Prix HT</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Delai</th>
                </tr>
              </thead>
              <tbody>
                {(tarifs ?? []).map((t, i) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{fournisseurNom(t.fournisseurId)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${i === 0 ? "text-emerald-400" : ""}`}>
                      {Number(t.prixUnitaireHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="px-3 py-2">{t.referenceFournisseur || "—"}</td>
                    <td className="px-3 py-2">{t.delaiLivraisonJours ? `${t.delaiLivraisonJours} j` : "—"}</td>
                  </tr>
                ))}
                {!tarifsLoading && (tarifs ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Aucun tarif fournisseur pour cet article.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={handleAddTarif} className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tarifFournisseurId">Fournisseur</Label>
                <select
                  id="tarifFournisseurId"
                  required
                  className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                  value={tarifForm.fournisseurId}
                  onChange={(e) => setTarifForm({ ...tarifForm, fournisseurId: e.target.value })}
                >
                  <option value="">Selectionner...</option>
                  {(fournisseurs ?? []).map((f) => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tarifPrix">Prix unitaire HT</Label>
                <Input
                  id="tarifPrix"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={tarifForm.prixUnitaireHt}
                  onChange={(e) => setTarifForm({ ...tarifForm, prixUnitaireHt: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tarifReference">Reference fournisseur</Label>
                <Input
                  id="tarifReference"
                  value={tarifForm.referenceFournisseur ?? ""}
                  onChange={(e) => setTarifForm({ ...tarifForm, referenceFournisseur: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tarifDelai">Delai de livraison (jours)</Label>
                <Input
                  id="tarifDelai"
                  type="number"
                  min={0}
                  value={tarifForm.delaiLivraisonJours ?? ""}
                  onChange={(e) => setTarifForm({ ...tarifForm, delaiLivraisonJours: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
            {tarifError && <p className="text-sm text-red-400">{tarifError}</p>}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={tarifSaving}>{tarifSaving ? "Enregistrement..." : "Ajouter / mettre a jour"}</Button>
            </div>
          </form>
        </div>
      </Dialog>
    </Layout>
  );
}
