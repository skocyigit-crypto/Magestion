import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createFournisseur,
  listFournisseurs,
  updateFournisseur,
  type Fournisseur,
  type FournisseurInput,
} from "@/lib/fournisseurs";

const EMPTY_FORM: FournisseurInput = { nom: "" };

export default function FournisseursPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: fournisseurs, isLoading, isError } = useQuery({
    queryKey: ["fournisseurs", showArchived],
    queryFn: () => listFournisseurs(showArchived),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FournisseurInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const all = fournisseurs ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((f) => f.nom.toLowerCase().includes(q) || (f.email ?? "").toLowerCase().includes(q));
  }, [all, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setIsOpen(true);
  }

  function openEdit(f: Fournisseur) {
    setEditingId(f.id);
    setForm({
      nom: f.nom,
      email: f.email ?? undefined,
      telephone: f.telephone ?? undefined,
      adresse: f.adresse ?? undefined,
      codePostal: f.codePostal ?? undefined,
      ville: f.ville ?? undefined,
      siret: f.siret ?? undefined,
      tvaIntracommunautaire: f.tvaIntracommunautaire ?? undefined,
      iban: f.iban ?? undefined,
      bic: f.bic ?? undefined,
      conditionsPaiement: f.conditionsPaiement ?? undefined,
      notes: f.notes ?? undefined,
    });
    setError(null);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateFournisseur(editingId, form);
      } else {
        await createFournisseur(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["fournisseurs"] });
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(f: Fournisseur) {
    await updateFournisseur(f.id, { active: !f.active });
    await queryClient.invalidateQueries({ queryKey: ["fournisseurs"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Fournisseurs</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Nouveau fournisseur</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total fournisseurs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (nom, email)..."
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
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Ville</th>
                <th className="px-4 py-2">Conditions de paiement</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${f.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2">
                    <Link href={`/fournisseurs/${f.id}`} className="hover:underline">{f.nom}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{f.telephone || f.email || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{f.ville || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{f.conditionsPaiement || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(f)}>Modifier</Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(f)}>
                        {f.active ? "Archiver" : "Reactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun fournisseur pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>{editingId ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom / Raison sociale</Label>
            <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telephone">Telephone</Label>
              <Input id="telephone" value={form.telephone ?? ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adresse">Adresse</Label>
            <Input id="adresse" value={form.adresse ?? ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="codePostal">Code postal</Label>
              <Input id="codePostal" value={form.codePostal ?? ""} onChange={(e) => setForm({ ...form, codePostal: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ville">Ville</Label>
              <Input id="ville" value={form.ville ?? ""} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="siret">SIRET</Label>
              <Input id="siret" value={form.siret ?? ""} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tva">TVA intracommunautaire</Label>
              <Input id="tva" value={form.tvaIntracommunautaire ?? ""} onChange={(e) => setForm({ ...form, tvaIntracommunautaire: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" value={form.iban ?? ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bic">BIC</Label>
              <Input id="bic" value={form.bic ?? ""} onChange={(e) => setForm({ ...form, bic: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conditionsPaiement">Conditions de paiement</Label>
            <Input id="conditionsPaiement" placeholder="Ex: 30 jours fin de mois" value={form.conditionsPaiement ?? ""} onChange={(e) => setForm({ ...form, conditionsPaiement: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
