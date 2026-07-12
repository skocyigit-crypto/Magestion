import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FACTURE_STATUT_LABELS,
  FACTURE_E_STATUT_LABELS,
  changeFactureStatut,
  downloadFacturePdf,
  downloadFacturxXml,
  getFacture,
  rafraichirStatutPdp,
  transmettrePdp,
  updateFacture,
  type FactureUpdateInput,
} from "@/lib/factures";
import { montantTtc, TAUX_TVA_OPTIONS, type TauxTva } from "@/lib/devis";

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: facture, isLoading, isError } = useQuery({ queryKey: ["factures", id], queryFn: () => getFacture(id) });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<FactureUpdateInput>({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const [pdpBusy, setPdpBusy] = useState(false);
  const [pdpError, setPdpError] = useState<string | null>(null);

  function openEdit() {
    if (!facture) return;
    setForm({
      objet: facture.objet,
      clientEmail: facture.clientEmail ?? undefined,
      clientAdresse: facture.clientAdresse ?? undefined,
      clientCodePostal: facture.clientCodePostal ?? undefined,
      clientVille: facture.clientVille ?? undefined,
      clientSiret: facture.clientSiret ?? undefined,
      clientPays: facture.clientPays ?? undefined,
      montantHt: Number(facture.montantHt),
      tauxTva: Number(facture.tauxTva) as TauxTva,
      dateEcheance: facture.dateEcheance ?? undefined,
    });
    setEditError(null);
    setIsEditOpen(true);
  }

  async function handleTransmettrePdp() {
    setPdpError(null);
    setPdpBusy(true);
    try {
      await transmettrePdp(id);
      await queryClient.invalidateQueries({ queryKey: ["factures", id] });
    } catch (err) {
      setPdpError(err instanceof Error ? err.message : "Echec de la transmission");
    } finally {
      setPdpBusy(false);
    }
  }

  async function handleRafraichirStatutPdp() {
    setPdpError(null);
    setPdpBusy(true);
    try {
      await rafraichirStatutPdp(id);
      await queryClient.invalidateQueries({ queryKey: ["factures", id] });
    } catch (err) {
      setPdpError(err instanceof Error ? err.message : "Echec du rafraichissement");
    } finally {
      setPdpBusy(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      await updateFacture(id, form);
      await queryClient.invalidateQueries({ queryKey: ["factures", id] });
      await queryClient.invalidateQueries({ queryKey: ["factures"] });
      setIsEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(statut: "ENVOYEE" | "PAYEE" | "EN_RETARD") {
    setSendNotice(null);
    const result = await changeFactureStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["factures", id] });
    await queryClient.invalidateQueries({ queryKey: ["factures"] });
    if (statut === "ENVOYEE") {
      if (result.emailSent) {
        setSendNotice("Email envoye au client avec le PDF en piece jointe.");
      } else if (result.emailError) {
        setSendNotice(`Statut mis a jour, mais email non envoye : ${result.emailError}`);
      } else {
        setSendNotice("Statut mis a jour. Aucun email client renseigne — email non envoye.");
      }
    }
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (isError) return <Layout><p className="p-8 text-red-400">Erreur lors du chargement. Veuillez reessayer.</p></Layout>;
  if (!facture) return <Layout><p className="p-8 text-muted-foreground">Facture introuvable.</p></Layout>;

  const verrouillee = facture.statut !== "BROUILLON";

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{facture.numero}</h1>
            <p className="text-muted-foreground">{facture.client} — {facture.objet}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadFacturePdf(facture.id, facture.numero)}>Telecharger PDF</Button>
            {facture.statut === "BROUILLON" && <Button variant="outline" onClick={openEdit}>Modifier</Button>}
            {facture.statut === "BROUILLON" && <Button onClick={() => handleTransition("ENVOYEE")}>Envoyer</Button>}
            {(facture.statut === "ENVOYEE" || facture.statut === "EN_RETARD") && (
              <Button onClick={() => handleTransition("PAYEE")}>Marquer payee</Button>
            )}
          </div>
        </div>

        {verrouillee && (
          <p className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            🔒 Facture emise — montant et objet verrouilles (regle de tracabilite financiere). Seul le statut peut encore evoluer.
          </p>
        )}
        {sendNotice && (
          <p className={`mb-4 text-sm ${sendNotice.startsWith("Email envoye") ? "text-emerald-400" : "text-orange-400"}`}>
            {sendNotice}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Montant HT</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(facture.montantHt).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>TVA</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{facture.tauxTva} %</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant TTC</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{montantTtc(facture.montantHt, facture.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{FACTURE_STATUT_LABELS[facture.statut]}</p></CardContent>
          </Card>
        </div>

        {facture.devisId && (
          <p className="mt-4 text-sm text-muted-foreground">
            Generee depuis le devis <a href={`/devis/${facture.devisId}`} className="text-primary hover:underline">associe</a>.
          </p>
        )}

        <Card className="mt-6">
          <CardHeader><CardTitle>Facturation electronique (Factur-X / PDP)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadFacturxXml(facture.id, facture.numero)}>
                Telecharger XML Factur-X
              </Button>
              {facture.statut !== "BROUILLON" && !facture.ePlatformRef && (
                <Button size="sm" onClick={handleTransmettrePdp} disabled={pdpBusy}>
                  {pdpBusy ? "Transmission..." : "Transmettre a la PDP"}
                </Button>
              )}
              {facture.ePlatformRef && (
                <Button variant="outline" size="sm" onClick={handleRafraichirStatutPdp} disabled={pdpBusy}>
                  {pdpBusy ? "..." : "Rafraichir le statut"}
                </Button>
              )}
            </div>
            {facture.statut === "BROUILLON" && (
              <p className="text-xs text-muted-foreground">La transmission PDP necessite une facture emise (non brouillon).</p>
            )}
            {facture.eStatut && (
              <p className="text-sm">
                Statut PDP : <span className="font-medium">{FACTURE_E_STATUT_LABELS[facture.eStatut]}</span>
                {facture.eSimulation && <span className="ml-2 rounded bg-orange-950/40 px-2 py-0.5 text-xs text-orange-400">SIMULATION — aucune PDP reelle configuree</span>}
              </p>
            )}
            {facture.ePlatformRef && (
              <p className="text-xs text-muted-foreground">Reference plateforme : {facture.ePlatformRef}</p>
            )}
            {(pdpError || facture.eErreur) && (
              <p className="text-sm text-red-400">{pdpError ?? facture.eErreur}</p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground">
          Une facture client ne peut jamais etre supprimee (tracabilite financiere) — seul l'archivage est possible.
        </p>
      </div>

      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <DialogHeader>
          <DialogTitle>Modifier la facture</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-objet">Objet</Label>
            <Input id="edit-objet" required value={form.objet ?? ""} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
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
            <Label htmlFor="edit-clientAdresse">Adresse client (requise pour la facturation electronique)</Label>
            <Input
              id="edit-clientAdresse"
              value={form.clientAdresse ?? ""}
              onChange={(e) => setForm({ ...form, clientAdresse: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-clientCodePostal">Code postal</Label>
              <Input
                id="edit-clientCodePostal"
                value={form.clientCodePostal ?? ""}
                onChange={(e) => setForm({ ...form, clientCodePostal: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="edit-clientVille">Ville</Label>
              <Input
                id="edit-clientVille"
                value={form.clientVille ?? ""}
                onChange={(e) => setForm({ ...form, clientVille: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-clientSiret">SIRET client (optionnel — si professionnel)</Label>
            <Input
              id="edit-clientSiret"
              value={form.clientSiret ?? ""}
              onChange={(e) => setForm({ ...form, clientSiret: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-montantHt">Montant HT (€)</Label>
              <Input
                id="edit-montantHt"
                type="number"
                min={0}
                value={form.montantHt ?? 0}
                onChange={(e) => setForm({ ...form, montantHt: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tauxTva">TVA</Label>
              <select
                id="edit-tauxTva"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.tauxTva ?? 20}
                onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) as TauxTva })}
              >
                {TAUX_TVA_OPTIONS.map((taux) => (
                  <option key={taux} value={taux}>{taux} %</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-dateEcheance">Date d'echeance</Label>
            <Input
              id="edit-dateEcheance"
              type="date"
              value={form.dateEcheance ?? ""}
              onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })}
            />
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
