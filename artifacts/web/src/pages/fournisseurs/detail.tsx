import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFournisseur, getFournisseurHistorique, updateFournisseur, type FournisseurInput } from "@/lib/fournisseurs";

export default function FournisseurDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: fournisseur, isLoading, isError } = useQuery({ queryKey: ["fournisseurs", id], queryFn: () => getFournisseur(id) });
  const { data: historique } = useQuery({ queryKey: ["fournisseurs", id, "historique"], queryFn: () => getFournisseurHistorique(id) });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<FournisseurInput>({ nom: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    if (!fournisseur) return;
    setForm({
      nom: fournisseur.nom,
      email: fournisseur.email ?? undefined,
      telephone: fournisseur.telephone ?? undefined,
      adresse: fournisseur.adresse ?? undefined,
      codePostal: fournisseur.codePostal ?? undefined,
      ville: fournisseur.ville ?? undefined,
      siret: fournisseur.siret ?? undefined,
      tvaIntracommunautaire: fournisseur.tvaIntracommunautaire ?? undefined,
      iban: fournisseur.iban ?? undefined,
      bic: fournisseur.bic ?? undefined,
      conditionsPaiement: fournisseur.conditionsPaiement ?? undefined,
      notes: fournisseur.notes ?? undefined,
    });
    setError(null);
    setIsEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateFournisseur(id, form);
      await queryClient.invalidateQueries({ queryKey: ["fournisseurs", id] });
      await queryClient.invalidateQueries({ queryKey: ["fournisseurs"] });
      setIsEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!fournisseur) return;
    await updateFournisseur(id, { active: !fournisseur.active });
    await queryClient.invalidateQueries({ queryKey: ["fournisseurs", id] });
    await queryClient.invalidateQueries({ queryKey: ["fournisseurs"] });
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (isError) return <Layout><p className="p-8 text-red-400">Erreur lors du chargement. Veuillez reessayer.</p></Layout>;
  if (!fournisseur) return <Layout><p className="p-8 text-muted-foreground">Fournisseur introuvable.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{fournisseur.nom}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit}>Modifier</Button>
            <Button variant="outline" onClick={handleToggleActive}>{fournisseur.active ? "Archiver" : "Reactiver"}</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Commandes</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{historique?.commandes.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Depenses</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{historique?.depenses.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total engage HT</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{(historique?.totalEngageHt ?? 0).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Coordonnees</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Email</p><p>{fournisseur.email || "—"}</p></div>
            <div><p className="text-muted-foreground">Telephone</p><p>{fournisseur.telephone || "—"}</p></div>
            <div><p className="text-muted-foreground">Adresse</p><p>{fournisseur.adresse || "—"}{fournisseur.codePostal ? ` (${fournisseur.codePostal})` : ""} {fournisseur.ville || ""}</p></div>
            <div><p className="text-muted-foreground">SIRET</p><p>{fournisseur.siret || "—"}</p></div>
            <div><p className="text-muted-foreground">IBAN / BIC</p><p>{fournisseur.iban || "—"} {fournisseur.bic ? `/ ${fournisseur.bic}` : ""}</p></div>
            <div><p className="text-muted-foreground">Conditions de paiement</p><p>{fournisseur.conditionsPaiement || "—"}</p></div>
            {fournisseur.notes && <div className="col-span-2"><p className="text-muted-foreground">Notes</p><p>{fournisseur.notes}</p></div>}
          </CardContent>
        </Card>

        <h2 className="mb-3 text-lg font-semibold">Commandes</h2>
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-2 pt-6">
            {(historique?.commandes ?? []).map((c) => (
              <div key={c.id} className="flex justify-between text-sm">
                <span>{c.objet} — {c.statut}</span>
                <span>{Number(c.montantHt).toLocaleString("fr-FR")} € HT</span>
              </div>
            ))}
            {(historique?.commandes.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Aucune commande pour ce fournisseur.</p>}
          </CardContent>
        </Card>

        <h2 className="mb-3 text-lg font-semibold">Depenses</h2>
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-2 pt-6">
            {(historique?.depenses ?? []).map((d) => (
              <div key={d.id} className="flex justify-between text-sm">
                <span>{d.objet} — {d.statut}</span>
                <span>{Number(d.montantHt).toLocaleString("fr-FR")} € HT</span>
              </div>
            ))}
            {(historique?.depenses.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Aucune depense pour ce fournisseur.</p>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <DialogHeader><DialogTitle>Modifier le fournisseur</DialogTitle></DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
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
            <Input id="conditionsPaiement" value={form.conditionsPaiement ?? ""} onChange={(e) => setForm({ ...form, conditionsPaiement: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
