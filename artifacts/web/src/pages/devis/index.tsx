import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DEVIS_STATUT_LABELS,
  TAUX_TVA_OPTIONS,
  createDevis,
  listDevis,
  montantTtc,
  type DevisInput,
  type TauxTva,
} from "@/lib/devis";
import { listProjects } from "@/lib/projects";

const EMPTY_FORM: DevisInput = { client: "", objet: "", montantHt: 0, tauxTva: 20 };

export default function DevisPage() {
  const queryClient = useQueryClient();
  const { data: devisList } = useQuery({ queryKey: ["devis"], queryFn: listDevis });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<DevisInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const all = devisList ?? [];
  const enCoursCount = all.filter((d) => d.statut === "ENVOYE").length;
  const tauxTransformation = (() => {
    const closes = all.filter((d) => d.statut === "ACCEPTE" || d.statut === "REFUSE").length;
    const acceptes = all.filter((d) => d.statut === "ACCEPTE").length;
    return closes > 0 ? Math.round((acceptes / closes) * 100) : null;
  })();
  const montantTotalHt = all.reduce((sum, d) => sum + Number(d.montantHt), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (d) =>
        d.numero.toLowerCase().includes(q) ||
        d.client.toLowerCase().includes(q) ||
        d.objet.toLowerCase().includes(q),
    );
  }, [all, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDevis(form);
      await queryClient.invalidateQueries({ queryKey: ["devis"] });
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
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Devis</h1>
          <Button onClick={() => setIsOpen(true)}>Nouveau devis</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Total devis</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En attente reponse</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{enCoursCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Taux de transformation</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{tauxTransformation !== null ? `${tauxTransformation} %` : "—"}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant total HT</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{montantTotalHt.toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (numero, client, objet)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Numero</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2">Montant TTC</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link href={`/devis/${d.id}`} className="text-primary hover:underline">{d.numero}</Link>
                  </td>
                  <td className="px-4 py-2">{d.client}</td>
                  <td className="px-4 py-2">{d.objet}</td>
                  <td className="px-4 py-2">{montantTtc(d.montantHt, d.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">{DEVIS_STATUT_LABELS[d.statut]}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun devis pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Nouveau devis</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client">Client</Label>
            <Input id="client" required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="objet">Objet</Label>
            <Input id="objet" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientEmail">Email client (optionnel — requis pour l'envoi par email)</Label>
            <Input
              id="clientEmail"
              type="email"
              value={form.clientEmail ?? ""}
              onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
            />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="montantHt">Montant HT (€)</Label>
              <Input
                id="montantHt"
                type="number"
                min={0}
                value={form.montantHt}
                onChange={(e) => setForm({ ...form, montantHt: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tauxTva">TVA</Label>
              <select
                id="tauxTva"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.tauxTva}
                onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) as TauxTva })}
              >
                {TAUX_TVA_OPTIONS.map((taux) => (
                  <option key={taux} value={taux}>{taux} %</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Montant TTC : {montantTtc(form.montantHt, form.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
          </p>
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
