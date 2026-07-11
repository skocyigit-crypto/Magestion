import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createSousTraitant, isAssuranceExpiree, listSousTraitants, type SousTraitantInput } from "@/lib/sousTraitants";

const EMPTY_FORM: SousTraitantInput = { raisonSociale: "", siret: "" };

export default function SousTraitantsPage() {
  const queryClient = useQueryClient();
  const { data: sousTraitants } = useQuery({ queryKey: ["sous-traitants"], queryFn: listSousTraitants });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<SousTraitantInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = sousTraitants ?? [];
  const assuranceExpiree = all.filter((s) => isAssuranceExpiree(s.assuranceDecennaleValidite)).length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createSousTraitant(form);
      await queryClient.invalidateQueries({ queryKey: ["sous-traitants"] });
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
          <h1 className="text-2xl font-semibold">Sous-traitants</h1>
          <Button onClick={() => setIsOpen(true)}>Ajouter un sous-traitant</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total sous-traitants</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Assurance decennale expiree</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${assuranceExpiree > 0 ? "text-red-400" : ""}`}>{assuranceExpiree}</p></CardContent>
          </Card>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Raison sociale</th>
                <th className="px-4 py-2">SIRET</th>
                <th className="px-4 py-2">Specialite</th>
                <th className="px-4 py-2">Assurance decennale</th>
              </tr>
            </thead>
            <tbody>
              {all.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{s.raisonSociale}</td>
                  <td className="px-4 py-2">{s.siret}</td>
                  <td className="px-4 py-2">{s.specialite || "—"}</td>
                  <td className={`px-4 py-2 ${isAssuranceExpiree(s.assuranceDecennaleValidite) ? "text-red-400" : ""}`}>
                    {s.assuranceDecennaleValidite ?? "Non renseignee"}
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Aucun sous-traitant pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Ajouter un sous-traitant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="raisonSociale">Raison sociale</Label>
            <Input id="raisonSociale" required value={form.raisonSociale} onChange={(e) => setForm({ ...form, raisonSociale: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="siret">SIRET (14 chiffres)</Label>
            <Input id="siret" required maxLength={14} value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="specialite">Specialite</Label>
            <Input id="specialite" value={form.specialite ?? ""} onChange={(e) => setForm({ ...form, specialite: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assurance">Assurance decennale — validite</Label>
            <Input
              id="assurance"
              type="date"
              value={form.assuranceDecennaleValidite ?? ""}
              onChange={(e) => setForm({ ...form, assuranceDecennaleValidite: e.target.value })}
            />
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
