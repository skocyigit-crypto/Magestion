import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PROCEDURE_LABELS,
  STATUT_LABELS,
  changeAppelOffreStatut,
  createAppelOffre,
  gagnerAppelOffre,
  listAppelsOffres,
  type AppelOffre,
  type AppelOffreInput,
  type AppelOffreStatut,
} from "@/lib/appelsOffres";
import { listClients } from "@/lib/clients";

const EMPTY_FORM: AppelOffreInput = { intitule: "" };

const NEXT_STATUTS: Record<AppelOffreStatut, AppelOffreStatut[]> = {
  VEILLE: ["EN_PREPARATION", "PERDU"],
  EN_PREPARATION: ["DEPOSE", "PERDU"],
  DEPOSE: ["RETENU", "REJETE"],
  RETENU: ["PERDU"],
  REJETE: [],
  GAGNE: [],
  PERDU: [],
};

export default function AppelsOffresPage() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data: appelsOffres, isLoading, isError } = useQuery({ queryKey: ["appels-offres"], queryFn: () => listAppelsOffres() });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<AppelOffreInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const all = appelsOffres ?? [];
  const enCours = all.filter((a) => !["GAGNE", "PERDU", "REJETE"].includes(a.statut)).length;
  const gagnes = all.filter((a) => a.statut === "GAGNE").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => a.intitule.toLowerCase().includes(q) || (a.organisme ?? "").toLowerCase().includes(q));
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
      await createAppelOffre(form);
      await queryClient.invalidateQueries({ queryKey: ["appels-offres"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(ao: AppelOffre, statut: AppelOffreStatut) {
    setActionError(null);
    try {
      await changeAppelOffreStatut(ao.id, statut as Exclude<AppelOffreStatut, "VEILLE" | "GAGNE">);
      await queryClient.invalidateQueries({ queryKey: ["appels-offres"] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors du changement de statut");
    }
  }

  async function handleGagner(ao: AppelOffre) {
    setActionError(null);
    try {
      const result = await gagnerAppelOffre(ao.id, { clientId: ao.clientId ?? undefined });
      await queryClient.invalidateQueries({ queryKey: ["appels-offres"] });
      navigate(`/marches-publics/${result.marche.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de la creation du marche");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Appels d'offres</h1>
          <Button onClick={openCreate}>Ajouter un appel d'offres</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En cours</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{enCours}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Gagnes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold text-emerald-400">{gagnes}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (intitule, organisme)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        {actionError && <p className="mb-4 text-sm text-red-400">{actionError}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Intitule</th>
                <th className="px-4 py-2">Organisme</th>
                <th className="px-4 py-2">Procedure</th>
                <th className="px-4 py-2">Date limite depot</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ao) => (
                <tr key={ao.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{ao.intitule}</td>
                  <td className="px-4 py-2">{ao.organisme || "—"}</td>
                  <td className="px-4 py-2">{PROCEDURE_LABELS[ao.typeProcedure]}</td>
                  <td className="px-4 py-2">{ao.dateLimiteDepot ? new Date(ao.dateLimiteDepot).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-2">{STATUT_LABELS[ao.statut]}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {NEXT_STATUTS[ao.statut].map((s) => (
                        <Button key={s} variant="outline" size="sm" onClick={() => handleTransition(ao, s)}>
                          {STATUT_LABELS[s]}
                        </Button>
                      ))}
                      {ao.statut === "RETENU" && (
                        <Button size="sm" onClick={() => handleGagner(ao)}>Transformer en marche</Button>
                      )}
                      {ao.marcheId && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/marches-publics/${ao.marcheId}`)}>Voir le marche</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun appel d'offres pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Ajouter un appel d'offres</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intitule">Intitule</Label>
            <Input id="intitule" required value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="organisme">Organisme (acheteur public)</Label>
              <Input id="organisme" value={form.organisme ?? ""} onChange={(e) => setForm({ ...form, organisme: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientId">Client associe (optionnel)</Label>
            <select
              id="clientId"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.clientId ?? ""}
              onChange={(e) => setForm({ ...form, clientId: e.target.value || undefined })}
            >
              <option value="">—</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="typeProcedure">Type de procedure</Label>
            <select
              id="typeProcedure"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.typeProcedure ?? "MAPA"}
              onChange={(e) => setForm({ ...form, typeProcedure: e.target.value as AppelOffreInput["typeProcedure"] })}
            >
              {Object.entries(PROCEDURE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateLimiteDepot">Date limite de depot</Label>
              <Input
                id="dateLimiteDepot"
                type="date"
                value={form.dateLimiteDepot ?? ""}
                onChange={(e) => setForm({ ...form, dateLimiteDepot: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="montantEstimeHt">Montant estime HT</Label>
              <Input
                id="montantEstimeHt"
                type="number"
                min={0}
                step="0.01"
                value={form.montantEstimeHt ?? ""}
                onChange={(e) => setForm({ ...form, montantEstimeHt: e.target.value ? Number(e.target.value) : undefined })}
              />
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
