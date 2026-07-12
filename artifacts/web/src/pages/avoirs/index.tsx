import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LigneEditor } from "@/components/ligne-editor";
import {
  AVOIR_STATUT_LABELS,
  createAvoir,
  downloadAvoirPdf,
  emettreAvoir,
  listAvoirs,
  type Avoir,
  type AvoirInput,
} from "@/lib/avoirs";
import { listFactures } from "@/lib/factures";
import { montantTtc, type LigneInput } from "@/lib/devis";

const EMPTY_LIGNE: LigneInput = { designation: "", quantite: 1, unite: "u", prixUnitaireHt: 0, remisePercent: 0 };

export default function AvoirsPage() {
  const queryClient = useQueryClient();
  const search = useSearch();
  const preselectedFactureId = new URLSearchParams(search).get("factureId") ?? "";

  const { data: avoirs, isLoading, isError } = useQuery({ queryKey: ["avoirs"], queryFn: listAvoirs });
  const { data: factures } = useQuery({ queryKey: ["factures"], queryFn: listFactures });
  const facturesEmises = (factures ?? []).filter((f) => f.statut !== "BROUILLON");

  const [isOpen, setIsOpen] = useState(!!preselectedFactureId);
  const [form, setForm] = useState<AvoirInput>({ factureId: preselectedFactureId, motif: "", lignes: [{ ...EMPTY_LIGNE }] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emitting, setEmitting] = useState<string | null>(null);

  const all = avoirs ?? [];

  function factureLabel(id: string): string {
    return (factures ?? []).find((f) => f.id === id)?.numero ?? "?";
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const lignesValides = form.lignes.filter((l) => l.designation.trim() && l.quantite > 0);
    if (!form.factureId || lignesValides.length === 0) {
      setError("Selectionnez une facture et ajoutez au moins une ligne");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAvoir({ ...form, lignes: lignesValides });
      await queryClient.invalidateQueries({ queryKey: ["avoirs"] });
      setIsOpen(false);
      setForm({ factureId: "", motif: "", lignes: [{ ...EMPTY_LIGNE }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  async function handleEmettre(avoir: Avoir) {
    if (!confirm(`Emettre l'avoir ${avoir.numero} ? Le contenu sera verrouille et l'ecriture comptable generee.`)) return;
    setEmitting(avoir.id);
    try {
      await emettreAvoir(avoir.id);
      await queryClient.invalidateQueries({ queryKey: ["avoirs"] });
    } finally {
      setEmitting(null);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Avoirs</h1>
          <Button onClick={() => setIsOpen(true)}>Nouvel avoir</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total avoirs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant total TTC</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.reduce((s, a) => s + montantTtc(a.montantHt, a.tauxTva), 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</p></CardContent>
          </Card>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="mb-4 text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Numero</th>
                <th className="px-4 py-2">Facture liee</th>
                <th className="px-4 py-2">Motif</th>
                <th className="px-4 py-2">Montant TTC</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {all.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{a.numero}</td>
                  <td className="px-4 py-2">
                    <Link href={`/factures/${a.factureId}`} className="text-primary hover:underline">{factureLabel(a.factureId)}</Link>
                  </td>
                  <td className="px-4 py-2">{a.motif}</td>
                  <td className="px-4 py-2">{montantTtc(a.montantHt, a.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">{AVOIR_STATUT_LABELS[a.statut]}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadAvoirPdf(a.id, a.numero)}>PDF</Button>
                      {a.statut === "BROUILLON" && (
                        <Button size="sm" onClick={() => handleEmettre(a)} disabled={emitting === a.id}>
                          {emitting === a.id ? "..." : "Emettre"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && all.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun avoir pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Nouvel avoir</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="factureId">Facture</Label>
            <select
              id="factureId"
              required
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.factureId}
              onChange={(e) => setForm({ ...form, factureId: e.target.value })}
            >
              <option value="">—</option>
              {facturesEmises.map((f) => (
                <option key={f.id} value={f.id}>{f.numero} — {f.client}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motif">Motif</Label>
            <Input id="motif" required value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Erreur de facturation, retour marchandise..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Lignes</Label>
            <LigneEditor lignes={form.lignes} onChange={(lignes) => setForm({ ...form, lignes })} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer (brouillon)"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
