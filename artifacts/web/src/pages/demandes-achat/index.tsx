import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  STATUT_LABELS,
  approuverDemandeAchat,
  convertirDemandeEnCommande,
  createDemandeAchat,
  listDemandesAchat,
  rejeterDemandeAchat,
  type ConvertirCommandeInput,
  type DemandeAchat,
  type DemandeAchatInput,
} from "@/lib/demandesAchat";
import { listProjects } from "@/lib/projects";
import { listEmployees } from "@/lib/employees";
import { listFournisseurs } from "@/lib/fournisseurs";

const EMPTY_FORM: DemandeAchatInput = { objet: "" };

export default function DemandesAchatPage() {
  const queryClient = useQueryClient();
  const { data: demandes, isLoading, isError } = useQuery({ queryKey: ["demandes-achat"], queryFn: () => listDemandesAchat() });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const { data: fournisseurs } = useQuery({ queryKey: ["fournisseurs"], queryFn: () => listFournisseurs() });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<DemandeAchatInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const all = demandes ?? [];
  const enAttente = all.filter((d) => d.statut === "EN_ATTENTE").length;
  const convertie = all.filter((d) => d.statut === "CONVERTIE").length;

  const projectNom = (id: string | null) => (id && (projects ?? []).find((p) => p.id === id)?.nom) || "—";
  const employeeNom = (id: string | null) => {
    const e = id ? (employees ?? []).find((x) => x.id === id) : undefined;
    return e ? `${e.prenom} ${e.nom}` : "—";
  };

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
      await createDemandeAchat(form);
      await queryClient.invalidateQueries({ queryKey: ["demandes-achat"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprouver(id: string) {
    setActionError(null);
    try {
      await approuverDemandeAchat(id);
      await queryClient.invalidateQueries({ queryKey: ["demandes-achat"] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleRejeter(id: string) {
    setActionError(null);
    const motif = window.prompt("Motif du rejet (optionnel)") ?? undefined;
    try {
      await rejeterDemandeAchat(id, motif);
      await queryClient.invalidateQueries({ queryKey: ["demandes-achat"] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    }
  }

  const [convertirDemande, setConvertirDemande] = useState<DemandeAchat | null>(null);
  const [convertirForm, setConvertirForm] = useState<ConvertirCommandeInput>({ fournisseur: "", montantHt: 0, tauxTva: 20 });
  const [convertirSaving, setConvertirSaving] = useState(false);
  const [convertirError, setConvertirError] = useState<string | null>(null);

  function openConvertir(d: DemandeAchat) {
    setConvertirDemande(d);
    setConvertirForm({ fournisseur: "", montantHt: d.montantEstimeHt ? Number(d.montantEstimeHt) : 0, tauxTva: 20 });
    setConvertirError(null);
  }

  async function handleConvertir(e: React.FormEvent) {
    e.preventDefault();
    if (!convertirDemande) return;
    setConvertirSaving(true);
    setConvertirError(null);
    try {
      await convertirDemandeEnCommande(convertirDemande.id, convertirForm);
      await queryClient.invalidateQueries({ queryKey: ["demandes-achat"] });
      await queryClient.invalidateQueries({ queryKey: ["commandes"] });
      setConvertirDemande(null);
    } catch (err) {
      setConvertirError(err instanceof Error ? err.message : "Erreur lors de la conversion");
    } finally {
      setConvertirSaving(false);
    }
  }

  const filtered = useMemo(() => all, [all]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Demandes d'achat</h1>
          <Button onClick={openCreate}>Nouvelle demande</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En attente d'approbation</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${enAttente > 0 ? "text-orange-400" : ""}`}>{enAttente}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Converties en commande</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold text-emerald-400">{convertie}</p></CardContent>
          </Card>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        {actionError && <p className="mb-4 text-sm text-red-400">{actionError}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2">Chantier</th>
                <th className="px-4 py-2">Demandeur</th>
                <th className="px-4 py-2 text-right">Montant estime</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{d.objet}</td>
                  <td className="px-4 py-2">{projectNom(d.projectId)}</td>
                  <td className="px-4 py-2">{employeeNom(d.demandeurId)}</td>
                  <td className="px-4 py-2 text-right">{d.montantEstimeHt ? `${Number(d.montantEstimeHt).toLocaleString("fr-FR")} €` : "—"}</td>
                  <td className="px-4 py-2">{STATUT_LABELS[d.statut]}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {d.statut === "EN_ATTENTE" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleApprouver(d.id)}>Approuver</Button>
                          <Button variant="outline" size="sm" onClick={() => handleRejeter(d.id)}>Rejeter</Button>
                        </>
                      )}
                      {d.statut === "APPROUVEE" && (
                        <Button size="sm" onClick={() => openConvertir(d)}>Convertir en commande</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucune demande d'achat pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Nouvelle demande d'achat</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="objet">Objet</Label>
            <Input id="objet" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="demandeurId">Demandeur (optionnel)</Label>
              <select
                id="demandeurId"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.demandeurId ?? ""}
                onChange={(e) => setForm({ ...form, demandeurId: e.target.value || undefined })}
              >
                <option value="">—</option>
                {(employees ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantiteEstimee">Quantite estimee</Label>
              <Input id="quantiteEstimee" value={form.quantiteEstimee ?? ""} onChange={(e) => setForm({ ...form, quantiteEstimee: e.target.value })} />
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

      <Dialog open={!!convertirDemande} onClose={() => setConvertirDemande(null)}>
        <DialogHeader><DialogTitle>Convertir en commande — {convertirDemande?.objet}</DialogTitle></DialogHeader>
        <form onSubmit={handleConvertir} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convFournisseurFiche">Fiche fournisseur (optionnel)</Label>
            <select
              id="convFournisseurFiche"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={convertirForm.fournisseurId ?? ""}
              onChange={(e) => {
                const selected = (fournisseurs ?? []).find((f) => f.id === e.target.value);
                setConvertirForm({ ...convertirForm, fournisseurId: e.target.value || undefined, fournisseur: selected ? selected.nom : convertirForm.fournisseur });
              }}
            >
              <option value="">— Fournisseur ponctuel (texte libre) —</option>
              {(fournisseurs ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convFournisseur">Fournisseur</Label>
            <Input id="convFournisseur" required value={convertirForm.fournisseur} onChange={(e) => setConvertirForm({ ...convertirForm, fournisseur: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="convMontantHt">Montant HT</Label>
              <Input id="convMontantHt" type="number" min={0} step="0.01" required value={convertirForm.montantHt} onChange={(e) => setConvertirForm({ ...convertirForm, montantHt: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="convTauxTva">TVA</Label>
              <select
                id="convTauxTva"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={convertirForm.tauxTva}
                onChange={(e) => setConvertirForm({ ...convertirForm, tauxTva: Number(e.target.value) as ConvertirCommandeInput["tauxTva"] })}
              >
                {[0, 5.5, 10, 20].map((taux) => (
                  <option key={taux} value={taux}>{taux} %</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convDateLivraison">Date de livraison prevue</Label>
            <Input id="convDateLivraison" type="date" value={convertirForm.dateLivraisonPrevue ?? ""} onChange={(e) => setConvertirForm({ ...convertirForm, dateLivraisonPrevue: e.target.value })} />
          </div>
          {convertirError && <p className="text-sm text-red-400">{convertirError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConvertirDemande(null)}>Annuler</Button>
            <Button type="submit" disabled={convertirSaving}>{convertirSaving ? "Conversion..." : "Convertir"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
