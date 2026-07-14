import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  HABILITATION_TYPE_LABELS,
  ROLE_LABELS,
  STATUT_LABELS,
  archiverHabilitation,
  createEmployeeHabilitation,
  fetchEmployeePhotoBlobUrl,
  getEmployee,
  listEmployeeHabilitations,
  updateEmployee,
  uploadEmployeePhoto,
  type HabilitationInput,
  type HabilitationType,
} from "@/lib/employees";
import { listPointage } from "@/lib/pointage";
import { TYPE_LABELS, listAffectations, startOfWeek, toDateStr } from "@/lib/planningPersonnel";
import { listProjects } from "@/lib/projects";

const EMPTY_HABILITATION: HabilitationInput = { type: "CACES", dateValidite: "" };

function formatHeure(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: employee, isLoading, isError } = useQuery({ queryKey: ["employees", id], queryFn: () => getEmployee(id) });
  const { data: pointages } = useQuery({ queryKey: ["pointage"], queryFn: listPointage });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: habilitations } = useQuery({ queryKey: ["employees", id, "habilitations"], queryFn: () => listEmployeeHabilitations(id) });

  const [habForm, setHabForm] = useState<HabilitationInput>(EMPTY_HABILITATION);
  const [photoBlobUrl, setPhotoBlobUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!employee?.photoUrl) {
      setPhotoBlobUrl(null);
      return;
    }
    let cancelled = false;
    fetchEmployeePhotoBlobUrl(id).then((url) => { if (!cancelled) setPhotoBlobUrl(url); });
    return () => { cancelled = true; };
  }, [id, employee?.photoUrl]);

  async function handleToggleConsent(checked: boolean) {
    setPhotoError(null);
    await updateEmployee(id, { consentementReconnaissanceFaciale: checked });
    await queryClient.invalidateQueries({ queryKey: ["employees", id] });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      await uploadEmployeePhoto(id, file);
      await queryClient.invalidateQueries({ queryKey: ["employees", id] });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Erreur lors du televersement");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleAjouterHabilitation(e: React.FormEvent) {
    e.preventDefault();
    if (!habForm.dateValidite) return;
    await createEmployeeHabilitation(id, habForm);
    setHabForm(EMPTY_HABILITATION);
    await queryClient.invalidateQueries({ queryKey: ["employees", id, "habilitations"] });
    await queryClient.invalidateQueries({ queryKey: ["employees", "echeances"] });
  }

  async function handleArchiverHabilitation(habId: string) {
    await archiverHabilitation(habId);
    await queryClient.invalidateQueries({ queryKey: ["employees", id, "habilitations"] });
    await queryClient.invalidateQueries({ queryKey: ["employees", "echeances"] });
  }

  // Planning : 2 semaines passees a 2 semaines a venir, assez pour donner du
  // contexte sans devoir paginer.
  const debut = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() - 14);
    return toDateStr(d);
  }, []);
  const fin = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() + 20);
    return toDateStr(d);
  }, []);
  const { data: affectations } = useQuery({ queryKey: ["planning-personnel", debut, fin], queryFn: () => listAffectations(debut, fin) });

  const pointagesForEmployee = (pointages ?? [])
    .filter((p) => p.employeeId === id)
    .sort((a, b) => new Date(b.heureArrivee).getTime() - new Date(a.heureArrivee).getTime())
    .slice(0, 15);

  const affectationsForEmployee = (affectations ?? [])
    .filter((a) => a.employeeId === id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const projectNom = (projectId: string | null) => (projects ?? []).find((p) => p.id === projectId)?.nom ?? "";

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (isError) return <Layout><p className="p-8 text-red-400">Erreur lors du chargement. Veuillez reessayer.</p></Layout>;
  if (!employee) return <Layout><p className="p-8 text-muted-foreground">Employe introuvable.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: employee.couleur }} />
          <div>
            <h1 className="text-2xl font-semibold">{employee.prenom} {employee.nom}</h1>
            <p className="text-muted-foreground">{ROLE_LABELS[employee.role]} — {STATUT_LABELS[employee.statut]}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Taux horaire</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(employee.tauxHoraire).toLocaleString("fr-FR")} €/h</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Telephone</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{employee.telephone || "—"}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Email</CardTitle></CardHeader>
            <CardContent><p className="truncate text-xl font-semibold">{employee.email || "—"}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{STATUT_LABELS[employee.statut]}</p></CardContent>
          </Card>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Pour modifier ces informations, allez sur <Link href="/equipe" className="text-primary hover:underline">la page Equipe</Link>.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Planning (4 semaines)</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {affectationsForEmployee.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span>{formatDate(a.date)}</span>
                  <span>{a.type === "CHANTIER" ? projectNom(a.projectId) || "Chantier" : TYPE_LABELS[a.type]}{a.chefEquipe && " (CE)"}</span>
                </div>
              ))}
              {affectationsForEmployee.length === 0 && <p className="text-sm text-muted-foreground">Aucune affectation sur cette periode.</p>}
              <Link href="/planning-personnel" className="text-sm text-primary hover:underline">Voir le planning complet →</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Historique de pointage</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {pointagesForEmployee.map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span>{formatDate(p.dateJour)}</span>
                  <span>{formatHeure(p.heureArrivee)} → {formatHeure(p.heureDepart)}</span>
                </div>
              ))}
              {pointagesForEmployee.length === 0 && <p className="text-sm text-muted-foreground">Aucun pointage enregistre.</p>}
              <Link href="/pointage" className="text-sm text-primary hover:underline">Voir le pointage complet →</Link>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader><CardTitle>Pointage par reconnaissance faciale</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-6">
            {photoBlobUrl ? (
              <img src={photoBlobUrl} alt="Photo de reference" className="h-20 w-20 rounded-full border border-border object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                Aucune photo
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={employee.consentementReconnaissanceFaciale}
                  onChange={(e) => handleToggleConsent(e.target.checked)}
                />
                L'employe consent a la reconnaissance faciale pour le pointage
              </label>
              <p className="text-xs text-muted-foreground">
                Donnee biometrique (RGPD) : le consentement doit etre recueilli aupres de l'employe avant d'activer
                cette option. Le retrait supprime immediatement la photo de reference.
              </p>
              {employee.consentementReconnaissanceFaciale && (
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} disabled={uploadingPhoto} className="text-sm" />
                  {uploadingPhoto && <span className="text-xs text-muted-foreground">Televersement...</span>}
                </div>
              )}
              {photoError && <p className="text-sm text-red-400">{photoError}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader><CardTitle>Documents et certifications (RH)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              {(habilitations ?? []).map((h) => {
                const joursRestants = Math.floor((new Date(h.dateValidite).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const alerte = joursRestants <= 30;
                return (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <span>{HABILITATION_TYPE_LABELS[h.type]}{h.libelle ? ` — ${h.libelle}` : ""}</span>
                    <div className="flex items-center gap-2">
                      <span className={alerte ? (joursRestants < 0 ? "text-red-400" : "text-orange-400") : "text-muted-foreground"}>
                        Valide jusqu'au {new Date(h.dateValidite).toLocaleDateString("fr-FR")}
                      </span>
                      <button type="button" onClick={() => handleArchiverHabilitation(h.id)} className="text-muted-foreground hover:text-red-400" title="Archiver">✕</button>
                    </div>
                  </div>
                );
              })}
              {(habilitations ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun document enregistre.</p>}
            </div>
            <form onSubmit={handleAjouterHabilitation} className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Type</Label>
                <select
                  className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                  value={habForm.type}
                  onChange={(e) => setHabForm({ ...habForm, type: e.target.value as HabilitationType })}
                >
                  {Object.entries(HABILITATION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Libelle (optionnel)</Label>
                <Input className="h-9 w-40" value={habForm.libelle ?? ""} onChange={(e) => setHabForm({ ...habForm, libelle: e.target.value })} placeholder="ex: R482 cat A" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Valide jusqu'au</Label>
                <Input className="h-9" type="date" value={habForm.dateValidite} onChange={(e) => setHabForm({ ...habForm, dateValidite: e.target.value })} />
              </div>
              <Button type="submit" size="sm">Ajouter</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
