import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORIE_LABELS,
  STATUT_LABELS,
  getProject,
  getProjectRentabilite,
  updateProject,
  type ProjectCategorie,
  type ProjectInput,
  type ProjectStatut,
} from "@/lib/projects";
import { DEVIS_STATUT_LABELS, listDevis, montantTtc } from "@/lib/devis";
import { FACTURE_STATUT_LABELS, listFactures } from "@/lib/factures";
import { STATUT_LABELS as DEPENSE_STATUT_LABELS, listDepenses } from "@/lib/depenses";
import { STATUT_LABELS as COMMANDE_STATUT_LABELS, listCommandes } from "@/lib/commandes";
import { STATUT_LABELS as SITUATION_STATUT_LABELS, listSituations } from "@/lib/situations";
import { listSousTraitants } from "@/lib/sousTraitants";
import { ajouterCharge, ajouterParticipant, archiverCharge, getProrata, retirerParticipant } from "@/lib/prorata";
import { getRetenueGarantie, libererRetenue } from "@/lib/retenuesGarantie";
import { createChantierPhase, listChantierPhases, updateChantierPhase, type ChantierPhaseInput } from "@/lib/chantierPlanning";
import {
  STATUT_LABELS as SOUS_CHANTIER_STATUT_LABELS,
  createSousChantier,
  listSousChantiers,
  updateSousChantier,
  type SousChantierInput,
  type SousChantierStatut,
} from "@/lib/sousChantiers";

export default function ChantierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => getProject(id),
  });

  const { data: devisList } = useQuery({ queryKey: ["devis"], queryFn: listDevis });
  const { data: facturesList } = useQuery({ queryKey: ["factures"], queryFn: listFactures });
  const { data: depensesList } = useQuery({ queryKey: ["depenses"], queryFn: () => listDepenses() });
  const { data: commandesList } = useQuery({ queryKey: ["commandes"], queryFn: () => listCommandes() });
  const { data: situationsList } = useQuery({ queryKey: ["situations", id], queryFn: () => listSituations(id) });
  const { data: sousTraitants } = useQuery({ queryKey: ["sous-traitants"], queryFn: () => listSousTraitants() });
  const { data: prorata, refetch: refetchProrata } = useQuery({ queryKey: ["prorata", id], queryFn: () => getProrata(id) });
  const { data: retenueGarantie, refetch: refetchRetenue } = useQuery({ queryKey: ["retenue-garantie", id], queryFn: () => getRetenueGarantie(id) });
  const { data: phases, refetch: refetchPhases } = useQuery({ queryKey: ["chantier-phases", id], queryFn: () => listChantierPhases(id) });
  const { data: rentabilite } = useQuery({ queryKey: ["projects", id, "rentabilite"], queryFn: () => getProjectRentabilite(id) });
  const { data: sousChantiers, refetch: refetchSousChantiers } = useQuery({ queryKey: ["sous-chantiers", id], queryFn: () => listSousChantiers(id) });

  const EMPTY_SOUS_CHANTIER: Omit<SousChantierInput, "projectId"> = { nom: "" };
  const [sousChantierForm, setSousChantierForm] = useState<Omit<SousChantierInput, "projectId">>(EMPTY_SOUS_CHANTIER);
  const [sousChantierError, setSousChantierError] = useState<string | null>(null);

  async function handleAjouterSousChantier(e: React.FormEvent) {
    e.preventDefault();
    if (!sousChantierForm.nom) return;
    setSousChantierError(null);
    try {
      await createSousChantier({ projectId: id, ...sousChantierForm });
      setSousChantierForm(EMPTY_SOUS_CHANTIER);
      await refetchSousChantiers();
    } catch (err) {
      setSousChantierError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  }

  async function handleSousChantierAvancement(scId: string, avancementPercent: number) {
    await updateSousChantier(scId, { avancementPercent });
    await refetchSousChantiers();
  }

  async function handleSousChantierStatut(scId: string, statut: SousChantierStatut) {
    await updateSousChantier(scId, { statut });
    await refetchSousChantiers();
  }

  async function handleToggleSousChantierActive(scId: string, active: boolean) {
    await updateSousChantier(scId, { active: !active });
    await refetchSousChantiers();
  }

  const devisForProject = (devisList ?? []).filter((d) => d.projectId === id);
  const facturesForProject = (facturesList ?? []).filter((f) => f.projectId === id);
  const depensesForProject = (depensesList ?? []).filter((d) => d.projectId === id);
  const commandesForProject = (commandesList ?? []).filter((c) => c.projectId === id);
  const situationsForProject = situationsList ?? [];

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<ProjectInput>({ nom: "", client: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nouveauParticipantId, setNouveauParticipantId] = useState("");
  const [nouvelleCharge, setNouvelleCharge] = useState({ libelle: "", montantHt: 0, dateOperation: "" });

  async function handleAjouterParticipant() {
    if (!nouveauParticipantId) return;
    await ajouterParticipant(id, nouveauParticipantId);
    setNouveauParticipantId("");
    await refetchProrata();
  }

  async function handleRetirerParticipant(lienId: string) {
    await retirerParticipant(lienId);
    await refetchProrata();
  }

  async function handleAjouterCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!nouvelleCharge.libelle || !nouvelleCharge.dateOperation) return;
    await ajouterCharge(id, nouvelleCharge);
    setNouvelleCharge({ libelle: "", montantHt: 0, dateOperation: "" });
    await refetchProrata();
  }

  async function handleArchiverCharge(chargeId: string) {
    await archiverCharge(chargeId);
    await refetchProrata();
  }

  const [liberationForm, setLiberationForm] = useState({ montant: 0, dateLiberation: "" });
  const [liberationError, setLiberationError] = useState<string | null>(null);

  const EMPTY_PHASE: ChantierPhaseInput = { nom: "", dateDebut: "", dateFin: "" };
  const [phaseForm, setPhaseForm] = useState<ChantierPhaseInput>(EMPTY_PHASE);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  async function handleAjouterPhase(e: React.FormEvent) {
    e.preventDefault();
    setPhaseError(null);
    try {
      await createChantierPhase(id, phaseForm);
      setPhaseForm(EMPTY_PHASE);
      await refetchPhases();
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  }

  async function handleAvancementChange(phaseId: string, avancementPercent: number) {
    await updateChantierPhase(phaseId, { avancementPercent });
    await refetchPhases();
  }

  async function handleTogglePhaseActive(phaseId: string, active: boolean) {
    await updateChantierPhase(phaseId, { active: !active });
    await refetchPhases();
  }

  async function handleLiberer(e: React.FormEvent) {
    e.preventDefault();
    if (!liberationForm.dateLiberation || liberationForm.montant <= 0) return;
    setLiberationError(null);
    try {
      await libererRetenue(id, liberationForm);
      setLiberationForm({ montant: 0, dateLiberation: "" });
      await refetchRetenue();
    } catch (err) {
      setLiberationError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  }

  function openEdit() {
    if (!project) return;
    setForm({
      nom: project.nom,
      client: project.client,
      adresse: project.adresse ?? undefined,
      codePostal: project.codePostal ?? undefined,
      budgetEstimeHt: Number(project.budgetEstimeHt),
      objectifMargePercent: Number(project.objectifMargePercent),
      categorie: project.categorie,
    });
    setError(null);
    setIsEditOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateProject(id, form);
      await queryClient.invalidateQueries({ queryKey: ["projects", id] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(statut: ProjectStatut) {
    await updateProject(id, { statut });
    await queryClient.invalidateQueries({ queryKey: ["projects", id] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  // Pas de suppression : archivage reversible uniquement (regle produit).
  async function handleToggleActive() {
    if (!project) return;
    await updateProject(id, { active: !project.active });
    await queryClient.invalidateQueries({ queryKey: ["projects", id] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (isError) return <Layout><p className="p-8 text-red-400">Erreur lors du chargement. Veuillez reessayer.</p></Layout>;
  if (!project) return <Layout><p className="p-8 text-muted-foreground">Chantier introuvable.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{project.nom}</h1>
            <p className="text-muted-foreground">{project.client}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit}>Modifier</Button>
            <Button variant="outline" onClick={handleToggleActive}>
              {project.active ? "Archiver" : "Reactiver"}
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Budget estime</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(project.budgetEstimeHt).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Objectif marge</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{project.objectifMargePercent} %</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Categorie</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{CATEGORIE_LABELS[project.categorie]}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent>
              <select
                className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm"
                value={project.statut}
                onChange={(e) => handleStatutChange(e.target.value as ProjectStatut)}
              >
                {Object.entries(STATUT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Adresse</CardTitle></CardHeader>
          <CardContent>
            <p>{project.adresse || "—"}{project.codePostal ? ` (${project.codePostal})` : ""}</p>
          </CardContent>
        </Card>

        {(() => {
          const budget = Number(project.budgetEstimeHt);
          // "Realise" = depenses + commandes engagees sur ce chantier (HT, hors
          // brouillons/annulations implicites — toutes les lignes actives
          // rattachees comptent des l'engagement, pas seulement au paiement,
          // pour un suivi budgetaire utile en cours de chantier).
          const realiseDepenses = depensesForProject.reduce((s, d) => s + Number(d.montantHt), 0);
          const realiseCommandes = commandesForProject.reduce((s, c) => s + Number(c.montantHt), 0);
          const realise = realiseDepenses + realiseCommandes;
          const pourcentage = budget > 0 ? Math.round((realise / budget) * 100) : null;
          const depassement = budget > 0 && realise > budget;
          return (
            <Card className="mb-6">
              <CardHeader><CardTitle>Budget vs realise</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Budget estime HT</p>
                    <p className="text-lg font-semibold">{budget.toLocaleString("fr-FR")} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Realise HT (depenses + commandes)</p>
                    <p className={`text-lg font-semibold ${depassement ? "text-red-400" : ""}`}>{realise.toLocaleString("fr-FR")} €</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reste disponible</p>
                    <p className={`text-lg font-semibold ${depassement ? "text-red-400" : "text-emerald-400"}`}>{(budget - realise).toLocaleString("fr-FR")} €</p>
                  </div>
                </div>
                {budget > 0 && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${depassement ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(pourcentage ?? 0, 100)}%` }}
                    />
                  </div>
                )}
                {budget === 0 && <p className="text-xs text-muted-foreground">Aucun budget estime renseigne — modifier le chantier pour en definir un.</p>}
                {depassement && <p className="text-sm text-red-400">Budget depasse de {(realise - budget).toLocaleString("fr-FR")} € ({pourcentage}%).</p>}
              </CardContent>
            </Card>
          );
        })()}

        {rentabilite && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Rentabilite reelle</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Chiffre d'affaires facture</p>
                  <p className="text-lg font-semibold">{rentabilite.revenuHt.toLocaleString("fr-FR")} €</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cout materiaux/sous-traitance</p>
                  <p className="text-lg font-semibold">{rentabilite.coutMateriauxHt.toLocaleString("fr-FR")} €</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cout main d'oeuvre ({rentabilite.heuresTravaillees.toFixed(1)} h)</p>
                  <p className="text-lg font-semibold">{rentabilite.coutMainOeuvreHt.toLocaleString("fr-FR")} €</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Marge reelle</p>
                  <p className={`text-lg font-semibold ${rentabilite.margeReelleHt < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {rentabilite.margeReelleHt.toLocaleString("fr-FR")} €
                    {rentabilite.margeReellePercent !== null && ` (${rentabilite.margeReellePercent.toFixed(1)}%)`}
                  </p>
                </div>
              </div>
              {rentabilite.margeReellePercent !== null && (
                <p className={`text-sm ${rentabilite.margeReellePercent < rentabilite.objectifMargePercent ? "text-orange-400" : "text-muted-foreground"}`}>
                  Objectif de marge : {rentabilite.objectifMargePercent}%
                  {rentabilite.margeReellePercent < rentabilite.objectifMargePercent ? " — en dessous de l'objectif" : " — objectif atteint"}
                </p>
              )}
              {rentabilite.revenuHt === 0 && (
                <p className="text-xs text-muted-foreground">Aucune facture emise sur ce chantier — la marge reelle ne peut pas encore etre calculee.</p>
              )}
            </CardContent>
          </Card>
        )}

        <h2 className="mb-3 mt-6 text-lg font-semibold">Planning (Gantt)</h2>
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-4 pt-6">
            {(() => {
              const rows = phases ?? [];
              if (rows.length === 0) {
                return <p className="text-sm text-muted-foreground">Aucune phase planifiee pour ce chantier.</p>;
              }
              const debuts = rows.map((p) => new Date(p.dateDebut).getTime());
              const fins = rows.map((p) => new Date(p.dateFin).getTime());
              const rangeStart = Math.min(...debuts);
              const rangeEnd = Math.max(...fins);
              const rangeSpan = Math.max(rangeEnd - rangeStart, 1);
              return (
                <div className="flex flex-col gap-3">
                  {rows.map((p) => {
                    const start = new Date(p.dateDebut).getTime();
                    const end = new Date(p.dateFin).getTime();
                    const leftPercent = ((start - rangeStart) / rangeSpan) * 100;
                    const widthPercent = Math.max(((end - start) / rangeSpan) * 100, 1.5);
                    const avancement = Number(p.avancementPercent);
                    return (
                      <div key={p.id} className={`flex flex-col gap-1 ${p.active ? "" : "opacity-50"}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{p.nom}</span>
                          <span className="text-muted-foreground">{p.dateDebut} → {p.dateFin} ({avancement}%)</span>
                        </div>
                        <div className="relative h-5 w-full rounded-md bg-muted">
                          <div
                            className="absolute top-0 h-full rounded-md border border-primary/40 bg-primary/20"
                            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          >
                            <div className="h-full rounded-l-md bg-primary/60" style={{ width: `${Math.min(avancement, 100)}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={avancement}
                            onChange={(e) => handleAvancementChange(p.id, Number(e.target.value))}
                            className="h-1.5 w-40"
                          />
                          <Button size="sm" variant="outline" onClick={() => handleTogglePhaseActive(p.id, p.active)}>
                            {p.active ? "Archiver" : "Reactiver"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <form onSubmit={handleAjouterPhase} className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Nom de la phase</Label>
                <Input className="h-9 w-48" value={phaseForm.nom} onChange={(e) => setPhaseForm({ ...phaseForm, nom: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Debut</Label>
                <Input className="h-9" type="date" value={phaseForm.dateDebut} onChange={(e) => setPhaseForm({ ...phaseForm, dateDebut: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Fin</Label>
                <Input className="h-9" type="date" value={phaseForm.dateFin} onChange={(e) => setPhaseForm({ ...phaseForm, dateFin: e.target.value })} />
              </div>
              <Button type="submit" size="sm" disabled={!phaseForm.nom || !phaseForm.dateDebut || !phaseForm.dateFin}>Ajouter une phase</Button>
            </form>
            {phaseError && <p className="text-sm text-red-400">{phaseError}</p>}
          </CardContent>
        </Card>

        <h2 className="mb-3 mt-6 text-lg font-semibold">Sous-chantiers</h2>
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-4 pt-6">
            {(sousChantiers ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun sous-chantier pour le moment (ex: batiments, lots, VRD pouvant avancer en parallele).</p>}
            {(sousChantiers ?? []).map((sc) => (
              <div key={sc.id} className={`flex flex-col gap-2 rounded-md border border-border p-3 ${sc.active ? "" : "opacity-50"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{sc.nom}</p>
                    {sc.description && <p className="text-xs text-muted-foreground">{sc.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                      value={sc.statut}
                      onChange={(e) => handleSousChantierStatut(sc.id, e.target.value as SousChantierStatut)}
                    >
                      {Object.entries(SOUS_CHANTIER_STATUT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => handleToggleSousChantierActive(sc.id, sc.active)}>
                      {sc.active ? "Archiver" : "Reactiver"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Number(sc.avancementPercent)}
                    onChange={(e) => handleSousChantierAvancement(sc.id, Number(e.target.value))}
                    className="h-1.5 w-40"
                  />
                  <span className="text-xs text-muted-foreground">{Number(sc.avancementPercent)}%</span>
                  {sc.budgetEstimeHt && <span className="text-xs text-muted-foreground">— Budget {Number(sc.budgetEstimeHt).toLocaleString("fr-FR")} €</span>}
                </div>
              </div>
            ))}

            <form onSubmit={handleAjouterSousChantier} className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Nom</Label>
                <Input className="h-9 w-48" placeholder="Batiment A" value={sousChantierForm.nom} onChange={(e) => setSousChantierForm({ ...sousChantierForm, nom: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Budget estime HT</Label>
                <Input
                  className="h-9 w-32"
                  type="number"
                  min={0}
                  value={sousChantierForm.budgetEstimeHt ?? ""}
                  onChange={(e) => setSousChantierForm({ ...sousChantierForm, budgetEstimeHt: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <Button type="submit" size="sm" disabled={!sousChantierForm.nom}>Ajouter un sous-chantier</Button>
            </form>
            {sousChantierError && <p className="text-sm text-red-400">{sousChantierError}</p>}
          </CardContent>
        </Card>

        <h2 className="mb-3 text-lg font-semibold">Suivi financier du chantier</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Devis ({devisForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {devisForProject.map((d) => (
                <Link key={d.id} href={`/devis/${d.id}`} className="flex justify-between text-sm hover:underline">
                  <span>{d.numero} — {DEVIS_STATUT_LABELS[d.statut]}</span>
                  <span>{montantTtc(d.montantHt, d.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                </Link>
              ))}
              {devisForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucun devis lie a ce chantier.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Factures ({facturesForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {facturesForProject.map((f) => (
                <Link key={f.id} href={`/factures/${f.id}`} className="flex justify-between text-sm hover:underline">
                  <span>{f.numero} — {FACTURE_STATUT_LABELS[f.statut]}</span>
                  <span>{montantTtc(f.montantHt, f.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                </Link>
              ))}
              {facturesForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucune facture liee a ce chantier.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Situations de travaux ({situationsForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {situationsForProject.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span>N°{s.numeroSituation} — {SITUATION_STATUT_LABELS[s.statut]}</span>
                  <span>{s.avancementPercent} %</span>
                </div>
              ))}
              {situationsForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucune situation pour ce chantier.</p>}
              <Link href="/situations" className="text-sm text-primary hover:underline">Voir toutes les situations →</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Depenses ({depensesForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {depensesForProject.map((d) => (
                <div key={d.id} className="flex justify-between text-sm">
                  <span>{d.fournisseur} — {DEPENSE_STATUT_LABELS[d.statut]}</span>
                  <span>{montantTtc(d.montantHt, d.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                </div>
              ))}
              {depensesForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucune depense liee a ce chantier.</p>}
              <Link href="/depenses" className="text-sm text-primary hover:underline">Voir toutes les depenses →</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Commandes ({commandesForProject.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {commandesForProject.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span>{c.fournisseur} — {COMMANDE_STATUT_LABELS[c.statut]}</span>
                  <span>{montantTtc(c.montantHt, c.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</span>
                </div>
              ))}
              {commandesForProject.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande liee a ce chantier.</p>}
              <Link href="/commandes" className="text-sm text-primary hover:underline">Voir toutes les commandes →</Link>
            </CardContent>
          </Card>
        </div>

        <h2 className="mb-3 mt-6 text-lg font-semibold">Compte prorata (charges communes de chantier)</h2>
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div>
              <p className="mb-2 text-sm font-medium">Sous-traitants participants ({prorata?.participants.length ?? 0})</p>
              <div className="flex flex-wrap gap-2">
                {(prorata?.participants ?? []).map((p) => (
                  <span key={p.lienId} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                    {p.raisonSociale}
                    <button type="button" onClick={() => handleRetirerParticipant(p.lienId)} className="text-muted-foreground hover:text-red-400">✕</button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <select
                  className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                  value={nouveauParticipantId}
                  onChange={(e) => setNouveauParticipantId(e.target.value)}
                >
                  <option value="">Ajouter un sous-traitant...</option>
                  {(sousTraitants ?? [])
                    .filter((s) => !(prorata?.participants ?? []).some((p) => p.sousTraitantId === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.raisonSociale}</option>
                    ))}
                </select>
                <Button size="sm" variant="outline" onClick={handleAjouterParticipant} disabled={!nouveauParticipantId}>Ajouter</Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Charges communes ({prorata?.charges.length ?? 0})</p>
              <div className="flex flex-col gap-1">
                {(prorata?.charges ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span>{c.dateOperation} — {c.libelle}</span>
                    <div className="flex items-center gap-2">
                      <span>{Number(c.montantHt).toLocaleString("fr-FR")} € HT</span>
                      <button type="button" onClick={() => handleArchiverCharge(c.id)} className="text-muted-foreground hover:text-red-400" title="Archiver">✕</button>
                    </div>
                  </div>
                ))}
                {(prorata?.charges.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Aucune charge commune.</p>}
              </div>
              <form onSubmit={handleAjouterCharge} className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Libelle</Label>
                  <Input className="h-9 w-40" value={nouvelleCharge.libelle} onChange={(e) => setNouvelleCharge({ ...nouvelleCharge, libelle: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Montant HT</Label>
                  <Input className="h-9 w-28" type="number" min={0} value={nouvelleCharge.montantHt} onChange={(e) => setNouvelleCharge({ ...nouvelleCharge, montantHt: Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Date</Label>
                  <Input className="h-9" type="date" value={nouvelleCharge.dateOperation} onChange={(e) => setNouvelleCharge({ ...nouvelleCharge, dateOperation: e.target.value })} />
                </div>
                <Button type="submit" size="sm">Ajouter</Button>
              </form>
            </div>

            {prorata && prorata.participants.length > 0 && (
              <div className="rounded-md bg-muted/30 p-3 text-sm">
                Total charges TTC : <span className="font-semibold">{prorata.totalTtc.toLocaleString("fr-FR")} €</span>
                {" — "}Part par participant (repartition egale) : <span className="font-semibold">{prorata.partParParticipant.toLocaleString("fr-FR")} €</span>
              </div>
            )}
          </CardContent>
        </Card>

        <h2 className="mb-3 mt-6 text-lg font-semibold">Retenue de garantie</h2>
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total retenu (situations validees)</p>
                <p className="text-lg font-semibold">{(retenueGarantie?.totalRetenue ?? 0).toLocaleString("fr-FR")} €</p>
              </div>
              <div>
                <p className="text-muted-foreground">Deja libere</p>
                <p className="text-lg font-semibold">{(retenueGarantie?.totalLibere ?? 0).toLocaleString("fr-FR")} €</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reste a liberer</p>
                <p className="text-lg font-semibold text-orange-400">{(retenueGarantie?.resteALiberer ?? 0).toLocaleString("fr-FR")} €</p>
              </div>
            </div>

            {(retenueGarantie?.liberations.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1">
                {retenueGarantie!.liberations.map((l) => (
                  <div key={l.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{l.dateLiberation} — {l.notes || "Liberation"}</span>
                    <span>{Number(l.montant).toLocaleString("fr-FR")} €</span>
                  </div>
                ))}
              </div>
            )}

            {(retenueGarantie?.resteALiberer ?? 0) > 0 && (
              <form onSubmit={handleLiberer} className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Montant a liberer</Label>
                  <Input className="h-9 w-32" type="number" min={0} value={liberationForm.montant} onChange={(e) => setLiberationForm({ ...liberationForm, montant: Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Date</Label>
                  <Input className="h-9" type="date" value={liberationForm.dateLiberation} onChange={(e) => setLiberationForm({ ...liberationForm, dateLiberation: e.target.value })} />
                </div>
                <Button type="submit" size="sm">Enregistrer la liberation</Button>
              </form>
            )}
            {liberationError && <p className="text-sm text-red-400">{liberationError}</p>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <DialogHeader>
          <DialogTitle>Modifier le chantier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client">Client</Label>
              <Input id="client" required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" value={form.adresse ?? ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="codePostal">Code postal</Label>
              <Input id="codePostal" value={form.codePostal ?? ""} onChange={(e) => setForm({ ...form, codePostal: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budgetEstimeHt">Budget estime HT (€)</Label>
              <Input
                id="budgetEstimeHt"
                type="number"
                min={0}
                value={form.budgetEstimeHt ?? 0}
                onChange={(e) => setForm({ ...form, budgetEstimeHt: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="objectifMargePercent">Objectif marge (%)</Label>
              <Input
                id="objectifMargePercent"
                type="number"
                min={0}
                max={100}
                value={form.objectifMargePercent ?? 0}
                onChange={(e) => setForm({ ...form, objectifMargePercent: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categorie">Categorie</Label>
            <select
              id="categorie"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.categorie ?? "AUTRE"}
              onChange={(e) => setForm({ ...form, categorie: e.target.value as ProjectCategorie })}
            >
              {Object.entries(CATEGORIE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
