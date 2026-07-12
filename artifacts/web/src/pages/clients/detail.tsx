import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TYPE_LABELS, getClient, getClientHistorique, updateClient, type ClientInput, type ClientType } from "@/lib/clients";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: client, isLoading, isError } = useQuery({ queryKey: ["clients", id], queryFn: () => getClient(id) });
  const { data: historique } = useQuery({ queryKey: ["clients", id, "historique"], queryFn: () => getClientHistorique(id) });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<ClientInput>({ nom: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    if (!client) return;
    setForm({
      type: client.type,
      nom: client.nom,
      email: client.email ?? undefined,
      telephone: client.telephone ?? undefined,
      adresse: client.adresse ?? undefined,
      codePostal: client.codePostal ?? undefined,
      ville: client.ville ?? undefined,
      siret: client.siret ?? undefined,
      tvaIntracommunautaire: client.tvaIntracommunautaire ?? undefined,
      notes: client.notes ?? undefined,
    });
    setError(null);
    setIsEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateClient(id, form);
      await queryClient.invalidateQueries({ queryKey: ["clients", id] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      setIsEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!client) return;
    await updateClient(id, { active: !client.active });
    await queryClient.invalidateQueries({ queryKey: ["clients", id] });
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (isError) return <Layout><p className="p-8 text-red-400">Erreur lors du chargement. Veuillez reessayer.</p></Layout>;
  if (!client) return <Layout><p className="p-8 text-muted-foreground">Client introuvable.</p></Layout>;

  const risque = (historique?.nbFacturesImpayees ?? 0) > 0;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{client.nom}</h1>
            <p className="text-muted-foreground">{TYPE_LABELS[client.type]}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit}>Modifier</Button>
            <Button variant="outline" onClick={handleToggleActive}>{client.active ? "Archiver" : "Reactiver"}</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Chantiers</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{historique?.projects.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>CA facture HT</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{(historique?.caFactureHt ?? 0).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Factures impayees</CardTitle></CardHeader>
            <CardContent><p className={`text-xl font-semibold ${risque ? "text-red-400" : ""}`}>{historique?.nbFacturesImpayees ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant impaye HT</CardTitle></CardHeader>
            <CardContent><p className={`text-xl font-semibold ${risque ? "text-red-400" : ""}`}>{(historique?.montantImpayeHt ?? 0).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Coordonnees</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Email</p><p>{client.email || "—"}</p></div>
            <div><p className="text-muted-foreground">Telephone</p><p>{client.telephone || "—"}</p></div>
            <div><p className="text-muted-foreground">Adresse</p><p>{client.adresse || "—"}{client.codePostal ? ` (${client.codePostal})` : ""} {client.ville || ""}</p></div>
            {client.type === "PROFESSIONNEL" && (
              <div><p className="text-muted-foreground">SIRET</p><p>{client.siret || "—"}</p></div>
            )}
            {client.notes && <div className="col-span-2"><p className="text-muted-foreground">Notes</p><p>{client.notes}</p></div>}
          </CardContent>
        </Card>

        <h2 className="mb-3 text-lg font-semibold">Chantiers lies</h2>
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-2 pt-6">
            {(historique?.projects ?? []).map((p) => (
              <Link key={p.id} href={`/chantiers/${p.id}`} className="flex justify-between text-sm hover:underline">
                <span>{p.nom}</span>
                <span className="text-muted-foreground">{p.statut}</span>
              </Link>
            ))}
            {(historique?.projects.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Aucun chantier rattache a ce client.</p>}
          </CardContent>
        </Card>

        <h2 className="mb-3 text-lg font-semibold">Factures</h2>
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-2 pt-6">
            {(historique?.factures ?? []).map((f) => (
              <Link key={f.id} href={`/factures/${f.id}`} className="flex justify-between text-sm hover:underline">
                <span>{f.numero} — {f.statut}</span>
                <span>{Number(f.montantHt).toLocaleString("fr-FR")} € HT</span>
              </Link>
            ))}
            {(historique?.factures.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Aucune facture pour ce client.</p>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <DialogHeader><DialogTitle>Modifier le client</DialogTitle></DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nom">Nom / Raison sociale</Label>
              <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.type ?? "PARTICULIER"}
                onChange={(e) => setForm({ ...form, type: e.target.value as ClientType })}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
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
          {form.type === "PROFESSIONNEL" && (
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
          )}
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
