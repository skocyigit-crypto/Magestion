import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createSousTraitant,
  isAssuranceExpiree,
  listSousTraitants,
  updateSousTraitant,
  type SousTraitant,
  type SousTraitantInput,
} from "@/lib/sousTraitants";

const EMPTY_FORM: SousTraitantInput = { raisonSociale: "", siret: "" };

export default function SousTraitantsPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: sousTraitants, isLoading } = useQuery({
    queryKey: ["sous-traitants", showArchived],
    queryFn: () => listSousTraitants(showArchived),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SousTraitantInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = sousTraitants ?? [];
  const assuranceExpiree = all.filter((s) => isAssuranceExpiree(s.assuranceDecennaleValidite)).length;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(st: SousTraitant) {
    setEditingId(st.id);
    setForm({
      raisonSociale: st.raisonSociale,
      siret: st.siret,
      specialite: st.specialite ?? undefined,
      contact: st.contact ?? undefined,
      telephone: st.telephone ?? undefined,
      email: st.email ?? undefined,
      assuranceDecennaleValidite: st.assuranceDecennaleValidite ?? undefined,
      urssafValidite: st.urssafValidite ?? undefined,
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateSousTraitant(editingId, form);
      } else {
        await createSousTraitant(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["sous-traitants"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(st: SousTraitant) {
    await updateSousTraitant(st.id, { active: !st.active });
    await queryClient.invalidateQueries({ queryKey: ["sous-traitants"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Sous-traitants</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Ajouter un sous-traitant</Button>
          </div>
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

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Raison sociale</th>
                <th className="px-4 py-2">SIRET</th>
                <th className="px-4 py-2">Specialite</th>
                <th className="px-4 py-2">Assurance decennale</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {all.map((s) => (
                <tr key={s.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${s.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2">{s.raisonSociale}</td>
                  <td className="px-4 py-2">{s.siret}</td>
                  <td className="px-4 py-2">{s.specialite || "—"}</td>
                  <td className={`px-4 py-2 ${isAssuranceExpiree(s.assuranceDecennaleValidite) ? "text-red-400" : ""}`}>
                    {s.assuranceDecennaleValidite ?? "Non renseignee"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(s)}>Modifier</Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(s)}>
                        {s.active ? "Archiver" : "Reactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && all.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun sous-traitant pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingId ? "Modifier le sous-traitant" : "Ajouter un sous-traitant"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact">Contact</Label>
              <Input id="contact" value={form.contact ?? ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telephone">Telephone</Label>
              <Input id="telephone" value={form.telephone ?? ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assurance">Assurance decennale — validite</Label>
              <Input
                id="assurance"
                type="date"
                value={form.assuranceDecennaleValidite ?? ""}
                onChange={(e) => setForm({ ...form, assuranceDecennaleValidite: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="urssaf">URSSAF — validite</Label>
              <Input
                id="urssaf"
                type="date"
                value={form.urssafValidite ?? ""}
                onChange={(e) => setForm({ ...form, urssafValidite: e.target.value })}
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
    </Layout>
  );
}
