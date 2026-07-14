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
  MARCHE_STATUT_LABELS,
  TYPE_MARCHE_LABELS,
  createMarchePublic,
  listMarchesPublics,
  type MarcheInput,
  type MarcheType,
} from "@/lib/marchesPublics";
import { listClients } from "@/lib/clients";
import { listProjects } from "@/lib/projects";

const EMPTY_FORM: MarcheInput = { intitule: "", clientId: "", montantInitialHt: 0, tauxTva: 20 };

export default function MarchesPublicsPage() {
  const queryClient = useQueryClient();
  const { data: marches, isLoading, isError } = useQuery({ queryKey: ["marches-publics"], queryFn: () => listMarchesPublics() });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<MarcheInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const all = marches ?? [];
  const enCours = all.filter((m) => m.statut === "EN_COURS").length;
  const montantTotal = all.reduce((sum, m) => sum + Number(m.montantActuelHt), 0);

  const clientNom = (id: string) => (clients ?? []).find((c) => c.id === id)?.nom ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((m) => m.intitule.toLowerCase().includes(q) || m.numero.toLowerCase().includes(q));
  }, [all, search]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createMarchePublic(form);
      await queryClient.invalidateQueries({ queryKey: ["marches-publics"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      window.location.assign(`/marches-publics/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Marches publics</h1>
          <Button onClick={openCreate}>Ajouter un marche</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total marches</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En cours</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{enCours}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant total HT (actuel)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{montantTotal.toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (numero, intitule)..."
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
                <th className="px-4 py-2">Numero</th>
                <th className="px-4 py-2">Intitule</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Montant actuel HT</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{m.numero}</td>
                  <td className="px-4 py-2">{m.intitule}</td>
                  <td className="px-4 py-2">{clientNom(m.clientId)}</td>
                  <td className="px-4 py-2">{TYPE_MARCHE_LABELS[m.typeMarche]}</td>
                  <td className="px-4 py-2">{Number(m.montantActuelHt).toLocaleString("fr-FR")} €</td>
                  <td className="px-4 py-2">{MARCHE_STATUT_LABELS[m.statut]}</td>
                  <td className="px-4 py-2">
                    <Link href={`/marches-publics/${m.id}`}>
                      <Button variant="outline" size="sm">Ouvrir</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Aucun marche pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Ajouter un marche public</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intitule">Intitule</Label>
            <Input id="intitule" required value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientId">Client (maitre d'ouvrage)</Label>
            <select
              id="clientId"
              required
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              <option value="">Selectionner...</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectId">Chantier (optionnel)</Label>
            <select
              id="projectId"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.projectId ?? ""}
              onChange={(e) => setForm({ ...form, projectId: e.target.value || undefined })}
            >
              <option value="">—</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="typeMarche">Type de marche</Label>
            <select
              id="typeMarche"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.typeMarche ?? "TRAVAUX"}
              onChange={(e) => setForm({ ...form, typeMarche: e.target.value as MarcheType })}
            >
              {Object.entries(TYPE_MARCHE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="montantInitialHt">Montant initial HT</Label>
              <Input
                id="montantInitialHt"
                type="number"
                required
                min={0}
                step="0.01"
                value={form.montantInitialHt}
                onChange={(e) => setForm({ ...form, montantInitialHt: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tauxTva">TVA</Label>
              <select
                id="tauxTva"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.tauxTva}
                onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) })}
              >
                {[0, 5.5, 10, 20].map((taux) => (
                  <option key={taux} value={taux}>{taux} %</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
