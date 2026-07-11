import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DEVIS_STATUT_LABELS,
  TAUX_TVA_OPTIONS,
  changeDevisStatut,
  convertirEnFacture,
  downloadDevisPdf,
  getDevis,
  montantTtc,
  updateDevis,
  type DevisInput,
  type TauxTva,
} from "@/lib/devis";
import { listProjects } from "@/lib/projects";
import { listFactures } from "@/lib/factures";

export default function DevisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: devis, isLoading, isError } = useQuery({ queryKey: ["devis", id], queryFn: () => getDevis(id) });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: facturesList } = useQuery({ queryKey: ["factures"], queryFn: listFactures });
  const factureIssue = (facturesList ?? []).find((f) => f.devisId === id);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<DevisInput>({ client: "", objet: "", montantHt: 0, tauxTva: 20 });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit() {
    if (!devis) return;
    setForm({
      client: devis.client,
      clientEmail: devis.clientEmail ?? undefined,
      objet: devis.objet,
      projectId: devis.projectId ?? undefined,
      montantHt: Number(devis.montantHt),
      tauxTva: Number(devis.tauxTva) as TauxTva,
    });
    setEditError(null);
    setIsEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      await updateDevis(id, form);
      await queryClient.invalidateQueries({ queryKey: ["devis", id] });
      await queryClient.invalidateQueries({ queryKey: ["devis"] });
      setIsEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(statut: "ENVOYE" | "ACCEPTE" | "REFUSE") {
    setSendNotice(null);
    const result = await changeDevisStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["devis", id] });
    await queryClient.invalidateQueries({ queryKey: ["devis"] });
    if (statut === "ENVOYE") {
      if (result.emailSent) {
        setSendNotice("Email envoye au client avec le PDF en piece jointe.");
      } else if (result.emailError) {
        setSendNotice(`Statut mis a jour, mais email non envoye : ${result.emailError}`);
      } else {
        setSendNotice("Statut mis a jour. Aucun email client renseigne — email non envoye.");
      }
    }
  }

  async function handleConvertir() {
    setConverting(true);
    setError(null);
    try {
      const facture = await convertirEnFacture(id);
      navigate(`/factures/${facture.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la conversion");
    } finally {
      setConverting(false);
    }
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (isError) return <Layout><p className="p-8 text-red-400">Erreur lors du chargement. Veuillez reessayer.</p></Layout>;
  if (!devis) return <Layout><p className="p-8 text-muted-foreground">Devis introuvable.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{devis.numero}</h1>
            <p className="text-muted-foreground">{devis.client} — {devis.objet}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadDevisPdf(devis.id, devis.numero)}>Telecharger PDF</Button>
            {devis.statut === "BROUILLON" && <Button variant="outline" onClick={openEdit}>Modifier</Button>}
            {devis.statut === "BROUILLON" && <Button onClick={() => handleTransition("ENVOYE")}>Envoyer</Button>}
            {devis.statut === "ENVOYE" && (
              <>
                <Button variant="outline" onClick={() => handleTransition("REFUSE")}>Marquer refuse</Button>
                <Button onClick={() => handleTransition("ACCEPTE")}>Marquer accepte</Button>
              </>
            )}
            {devis.statut === "ACCEPTE" && (
              <Button onClick={handleConvertir} disabled={converting}>
                {converting ? "Conversion..." : "Convertir en facture"}
              </Button>
            )}
          </div>
        </div>

        {factureIssue && (
          <p className="mb-4 text-sm text-muted-foreground">
            Facture generee : <Link href={`/factures/${factureIssue.id}`} className="text-primary hover:underline">{factureIssue.numero}</Link>
          </p>
        )}

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {sendNotice && (
          <p className={`mb-4 text-sm ${sendNotice.startsWith("Email envoye") ? "text-emerald-400" : "text-orange-400"}`}>
            {sendNotice}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Montant HT</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(devis.montantHt).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>TVA</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{devis.tauxTva} %</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant TTC</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{montantTtc(devis.montantHt, devis.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{DEVIS_STATUT_LABELS[devis.statut]}</p></CardContent>
          </Card>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Un devis ne peut jamais etre supprime (tracabilite financiere) — seul l'archivage est possible.
        </p>
      </div>

      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <DialogHeader>
          <DialogTitle>Modifier le devis</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-client">Client</Label>
            <Input id="edit-client" required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-objet">Objet</Label>
            <Input id="edit-objet" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-clientEmail">Email client (optionnel — requis pour l'envoi par email)</Label>
            <Input
              id="edit-clientEmail"
              type="email"
              value={form.clientEmail ?? ""}
              onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-projectId">Chantier (optionnel)</Label>
            <select
              id="edit-projectId"
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
              <Label htmlFor="edit-montantHt">Montant HT (€)</Label>
              <Input
                id="edit-montantHt"
                type="number"
                min={0}
                value={form.montantHt}
                onChange={(e) => setForm({ ...form, montantHt: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tauxTva">TVA</Label>
              <select
                id="edit-tauxTva"
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
          {editError && <p className="text-sm text-red-400">{editError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
