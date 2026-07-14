import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createArchiveDecennale,
  isArchiveExpiree,
  listArchivesDecennales,
  scellerArchiveDecennale,
  type ArchiveDecennaleInput,
} from "@/lib/archivesDecennales";
import { listProjects } from "@/lib/projects";
import { listSousTraitants } from "@/lib/sousTraitants";

const EMPTY_FORM: ArchiveDecennaleInput = {
  projectId: "",
  sousTraitantId: "",
  numeroAttestation: "",
  assureur: "",
  dateDebutValidite: "",
  dateFinValidite: "",
};

export default function ArchivesDecennalesPage() {
  const queryClient = useQueryClient();
  const { data: archives, isLoading, isError } = useQuery({ queryKey: ["archives-decennales"], queryFn: () => listArchivesDecennales() });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: sousTraitants } = useQuery({ queryKey: ["sous-traitants"], queryFn: () => listSousTraitants() });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ArchiveDecennaleInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const all = archives ?? [];
  const expirees = all.filter((a) => isArchiveExpiree(a.dateFinValidite)).length;

  const projectNom = (id: string) => (projects ?? []).find((p) => p.id === id)?.nom ?? "—";
  const sousTraitantNom = (id: string) => (sousTraitants ?? []).find((s) => s.id === id)?.raisonSociale ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => a.numeroAttestation.toLowerCase().includes(q) || a.assureur.toLowerCase().includes(q));
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
      await createArchiveDecennale(form);
      await queryClient.invalidateQueries({ queryKey: ["archives-decennales"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleSceller(id: string) {
    await scellerArchiveDecennale(id);
    await queryClient.invalidateQueries({ queryKey: ["archives-decennales"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Archives decennales</h1>
          <Button onClick={openCreate}>Ajouter une attestation</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total attestations</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Expirees</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${expirees > 0 ? "text-red-400" : ""}`}>{expirees}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (numero, assureur)..."
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
                <th className="px-4 py-2">Chantier</th>
                <th className="px-4 py-2">Sous-traitant</th>
                <th className="px-4 py-2">N° attestation</th>
                <th className="px-4 py-2">Assureur</th>
                <th className="px-4 py-2">Fin de validite</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{projectNom(a.projectId)}</td>
                  <td className="px-4 py-2">{sousTraitantNom(a.sousTraitantId)}</td>
                  <td className="px-4 py-2">{a.numeroAttestation}</td>
                  <td className="px-4 py-2">{a.assureur}</td>
                  <td className={`px-4 py-2 ${isArchiveExpiree(a.dateFinValidite) ? "text-red-400" : ""}`}>
                    {new Date(a.dateFinValidite).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">
                    {a.scelle ? (
                      <span className="text-xs text-muted-foreground">Scellee</span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleSceller(a.id)}>Sceller</Button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucune archive pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Une attestation scellee ne peut plus etre modifiee (conservation legale 10 ans).
        </p>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Ajouter une attestation decennale</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectId">Chantier</Label>
            <select
              id="projectId"
              required
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">Selectionner...</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sousTraitantId">Sous-traitant</Label>
            <select
              id="sousTraitantId"
              required
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.sousTraitantId}
              onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
            >
              <option value="">Selectionner...</option>
              {(sousTraitants ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.raisonSociale}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="numeroAttestation">N° attestation</Label>
              <Input id="numeroAttestation" required value={form.numeroAttestation} onChange={(e) => setForm({ ...form, numeroAttestation: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assureur">Assureur</Label>
              <Input id="assureur" required value={form.assureur} onChange={(e) => setForm({ ...form, assureur: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activiteCouverte">Activite couverte</Label>
            <Input id="activiteCouverte" value={form.activiteCouverte ?? ""} onChange={(e) => setForm({ ...form, activiteCouverte: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateDebutValidite">Debut de validite</Label>
              <Input id="dateDebutValidite" type="date" required value={form.dateDebutValidite} onChange={(e) => setForm({ ...form, dateDebutValidite: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateFinValidite">Fin de validite</Label>
              <Input id="dateFinValidite" type="date" required value={form.dateFinValidite} onChange={(e) => setForm({ ...form, dateFinValidite: e.target.value })} />
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
