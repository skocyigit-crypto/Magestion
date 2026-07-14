import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createIndiceBt, listIndicesBt, type IndiceBtInput } from "@/lib/indicesBt";

const EMPTY_FORM: IndiceBtInput = { code: "", libelle: "", periode: "", valeur: 0 };

// Reference pure : append-only, pas de PATCH ni de suppression. Chaque
// publication mensuelle INSEE est une nouvelle ligne (voir lib/indicesBt.ts).
export default function IndicesBtPage() {
  const queryClient = useQueryClient();
  const { data: indices, isLoading, isError } = useQuery({ queryKey: ["indices-bt"], queryFn: () => listIndicesBt() });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<IndiceBtInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = (indices ?? []).slice().sort((a, b) => (a.code === b.code ? b.periode.localeCompare(a.periode) : a.code.localeCompare(b.code)));

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
      await createIndiceBt(form);
      await queryClient.invalidateQueries({ queryKey: ["indices-bt"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
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
          <h1 className="text-2xl font-semibold">Indices BT/TP</h1>
          <Button onClick={openCreate}>Ajouter une publication</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Publications enregistrees</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Libelle</th>
                <th className="px-4 py-2">Periode</th>
                <th className="px-4 py-2">Valeur</th>
                <th className="px-4 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {all.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{i.code}</td>
                  <td className="px-4 py-2">{i.libelle}</td>
                  <td className="px-4 py-2">{i.periode}</td>
                  <td className="px-4 py-2">{i.valeur}</td>
                  <td className="px-4 py-2">{i.source || "—"}</td>
                </tr>
              ))}
              {!isLoading && !isError && all.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun indice pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Ajouter une publication d'indice</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" required placeholder="BT01" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periode">Periode</Label>
              <Input id="periode" required placeholder="2026-06" value={form.periode} onChange={(e) => setForm({ ...form, periode: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="libelle">Libelle</Label>
            <Input id="libelle" required value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valeur">Valeur</Label>
            <Input id="valeur" type="number" step="0.0001" required value={form.valeur} onChange={(e) => setForm({ ...form, valeur: Number(e.target.value) })} />
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
