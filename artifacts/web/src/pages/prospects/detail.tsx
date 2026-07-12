import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PIPELINE_STAGES,
  RAISON_PERTE_LABELS,
  STATUT_LABELS,
  URGENCE_LABELS,
  convertirEnDevis,
  getProspect,
  updateProspect,
  type ProspectInput,
  type ProspectStatut,
  type ProspectUrgence,
  type RaisonPerte,
} from "@/lib/prospects";

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: prospect, isLoading, isError } = useQuery({
    queryKey: ["prospects", id],
    queryFn: () => getProspect(id),
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<ProspectInput>({ nom: "" });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [isPerduOpen, setIsPerduOpen] = useState(false);
  const [raisonPerte, setRaisonPerte] = useState<RaisonPerte>("PRIX");
  const [raisonPerteDetail, setRaisonPerteDetail] = useState("");
  const [converting, setConverting] = useState(false);

  function openEdit() {
    if (!prospect) return;
    setForm({
      nom: prospect.nom,
      contact: prospect.contact ?? undefined,
      telephone: prospect.telephone ?? undefined,
      email: prospect.email ?? undefined,
      adresse: prospect.adresse ?? undefined,
      codePostal: prospect.codePostal ?? undefined,
      budgetEstime: Number(prospect.budgetEstime),
      distanceKm: prospect.distanceKm ? Number(prospect.distanceKm) : undefined,
      urgence: prospect.urgence,
      notes: prospect.notes ?? undefined,
    });
    setEditError(null);
    setIsEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      await updateProspect(id, form);
      await queryClient.invalidateQueries({ queryKey: ["prospects", id] });
      await queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setIsEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(statut: ProspectStatut) {
    if (statut === "PERDU") {
      setIsPerduOpen(true);
      return;
    }
    await updateProspect(id, { statut });
    await queryClient.invalidateQueries({ queryKey: ["prospects", id] });
    await queryClient.invalidateQueries({ queryKey: ["prospects"] });
  }

  async function handleConfirmPerdu(e: React.FormEvent) {
    e.preventDefault();
    await updateProspect(id, { statut: "PERDU", raisonPerte, raisonPerteDetail: raisonPerteDetail || undefined });
    await queryClient.invalidateQueries({ queryKey: ["prospects", id] });
    await queryClient.invalidateQueries({ queryKey: ["prospects"] });
    setIsPerduOpen(false);
    setRaisonPerteDetail("");
  }

  async function handleConvertirDevis() {
    setConverting(true);
    try {
      const devis = await convertirEnDevis(id);
      navigate(`/devis/${devis.id}`);
    } finally {
      setConverting(false);
    }
  }

  // Pas de suppression : archivage reversible uniquement (regle produit).
  async function handleToggleActive() {
    if (!prospect) return;
    await updateProspect(id, { active: !prospect.active });
    await queryClient.invalidateQueries({ queryKey: ["prospects", id] });
    await queryClient.invalidateQueries({ queryKey: ["prospects"] });
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (isError) return <Layout><p className="p-8 text-red-400">Erreur lors du chargement. Veuillez reessayer.</p></Layout>;
  if (!prospect) return <Layout><p className="p-8 text-muted-foreground">Prospect introuvable.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{prospect.nom}</h1>
            <p className="text-muted-foreground">{prospect.contact || "—"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit}>Modifier</Button>
            <Button onClick={handleConvertirDevis} disabled={converting}>{converting ? "Creation..." : "Creer un devis"}</Button>
            <Button variant="outline" onClick={handleToggleActive}>
              {prospect.active ? "Archiver" : "Reactiver"}
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Score</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{prospect.score} / 100</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Budget estime</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(prospect.budgetEstime).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Urgence</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{URGENCE_LABELS[prospect.urgence]}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent>
              <select
                className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm"
                value={prospect.statut}
                onChange={(e) => handleStatutChange(e.target.value as ProspectStatut)}
              >
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>{STATUT_LABELS[stage]}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Coordonnees</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>Telephone : {prospect.telephone || "—"}</p>
            <p>Email : {prospect.email || "—"}</p>
            <p>Adresse : {prospect.adresse || "—"}{prospect.codePostal ? ` (${prospect.codePostal})` : ""}</p>
          </CardContent>
        </Card>

        {prospect.notes && (
          <Card className="mt-4">
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{prospect.notes}</p></CardContent>
          </Card>
        )}

        {prospect.raisonPerte && (
          <Card className="mt-4 border-red-900/50">
            <CardHeader><CardTitle>Analyse de la perte</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p>Motif : <span className="font-medium">{RAISON_PERTE_LABELS[prospect.raisonPerte]}</span></p>
              {prospect.raisonPerteDetail && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{prospect.raisonPerteDetail}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isPerduOpen} onClose={() => setIsPerduOpen(false)}>
        <DialogHeader>
          <DialogTitle>Marquer ce prospect comme perdu</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleConfirmPerdu} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="raisonPerte">Motif</Label>
            <select
              id="raisonPerte"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={raisonPerte}
              onChange={(e) => setRaisonPerte(e.target.value as RaisonPerte)}
            >
              {Object.entries(RAISON_PERTE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="raisonPerteDetail">Detail (optionnel)</Label>
            <textarea
              id="raisonPerteDetail"
              className="min-h-16 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              value={raisonPerteDetail}
              onChange={(e) => setRaisonPerteDetail(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsPerduOpen(false)}>Annuler</Button>
            <Button type="submit">Confirmer</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <DialogHeader>
          <DialogTitle>Modifier le prospect</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-nom">Nom</Label>
              <Input id="edit-nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-contact">Contact</Label>
              <Input id="edit-contact" value={form.contact ?? ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-telephone">Telephone</Label>
              <Input id="edit-telephone" value={form.telephone ?? ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-adresse">Adresse</Label>
              <Input id="edit-adresse" value={form.adresse ?? ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-codePostal">Code postal</Label>
              <Input id="edit-codePostal" value={form.codePostal ?? ""} onChange={(e) => setForm({ ...form, codePostal: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-budgetEstime">Budget estime (€)</Label>
              <Input
                id="edit-budgetEstime"
                type="number"
                min={0}
                value={form.budgetEstime ?? 0}
                onChange={(e) => setForm({ ...form, budgetEstime: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-distanceKm">Distance (km)</Label>
              <Input
                id="edit-distanceKm"
                type="number"
                min={0}
                value={form.distanceKm ?? 0}
                onChange={(e) => setForm({ ...form, distanceKm: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-urgence">Urgence</Label>
              <select
                id="edit-urgence"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.urgence ?? "NORMALE"}
                onChange={(e) => setForm({ ...form, urgence: e.target.value as ProspectUrgence })}
              >
                {Object.entries(URGENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea
              id="edit-notes"
              className="min-h-20 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
