import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listEmployees } from "@/lib/employees";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
  listPointage,
  pointerArrivee,
  pointerDepart,
  updatePointage,
  type Pointage,
} from "@/lib/pointage";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatHeure(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function PointagePage() {
  const queryClient = useQueryClient();
  const { data: employees, isLoading: employeesLoading } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  // Le backend (routes/pointage.ts) retourne TOUTES les lignes sans filtre
  // `active` (pas de support onlyInactive) : le masquage des pointages
  // archives se fait donc cote client, voir visiblePointagesToday ci-dessous.
  const { data: pointages, isLoading: pointagesLoading } = useQuery({ queryKey: ["pointage"], queryFn: listPointage });

  const [showArchived, setShowArchived] = useState(false);

  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctForm, setCorrectForm] = useState({ heureArrivee: "", heureDepart: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayStr();
  const pointagesToday = (pointages ?? []).filter((p) => p.dateJour === today);
  const visiblePointagesToday = showArchived ? pointagesToday : pointagesToday.filter((p) => p.active);
  const present = pointagesToday.filter((p) => p.active && !p.heureDepart).length;

  function employeeName(employeeId: string): string {
    const emp = (employees ?? []).find((e) => e.id === employeeId);
    return emp ? `${emp.prenom} ${emp.nom}` : "Employe inconnu";
  }

  function openPointageFor(employeeId: string) {
    return pointagesToday.find((p) => p.employeeId === employeeId && p.active && !p.heureDepart);
  }

  async function handleArrivee(employeeId: string) {
    await pointerArrivee(employeeId);
    await queryClient.invalidateQueries({ queryKey: ["pointage"] });
  }

  async function handleDepart(id: string) {
    await pointerDepart(id);
    await queryClient.invalidateQueries({ queryKey: ["pointage"] });
  }

  function openCorrect(p: Pointage) {
    setCorrectingId(p.id);
    setCorrectForm({
      heureArrivee: isoToDatetimeLocal(p.heureArrivee),
      heureDepart: p.heureDepart ? isoToDatetimeLocal(p.heureDepart) : "",
    });
    setError(null);
  }

  async function handleCorrectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!correctingId) return;
    setSaving(true);
    setError(null);
    try {
      await updatePointage(correctingId, {
        heureArrivee: datetimeLocalToIso(correctForm.heureArrivee),
        // On n'envoie heureDepart que si l'utilisateur l'a renseigne : ne pas
        // ecraser un depart existant (ou en forcer un vide) par erreur.
        ...(correctForm.heureDepart ? { heureDepart: datetimeLocalToIso(correctForm.heureDepart) } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["pointage"] });
      setCorrectingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(p: Pointage) {
    await updatePointage(p.id, { active: !p.active });
    await queryClient.invalidateQueries({ queryKey: ["pointage"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Pointage</h1>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Presents actuellement</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{present}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Pointages aujourd'hui</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{pointagesToday.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total employes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{(employees ?? []).length}</p></CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          {(employees ?? []).map((emp) => {
            const open = openPointageFor(emp.id);
            return (
              <div key={emp.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: emp.couleur }} />
                  <span>{emp.prenom} {emp.nom}</span>
                  {open && <span className="text-xs text-muted-foreground">arrive a {formatHeure(open.heureArrivee)}</span>}
                </div>
                {open ? (
                  <Button size="sm" variant="outline" onClick={() => handleDepart(open.id)}>Pointer depart</Button>
                ) : (
                  <Button size="sm" onClick={() => handleArrivee(emp.id)}>Pointer arrivee</Button>
                )}
              </div>
            );
          })}
          {employeesLoading && <p className="text-muted-foreground">Chargement...</p>}
          {!employeesLoading && (employees ?? []).length === 0 && (
            <p className="text-muted-foreground">Ajoutez des employes dans Equipe pour commencer le pointage.</p>
          )}
        </div>

        <div className="mb-4 mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historique du jour</h2>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Afficher les archives
          </label>
        </div>

        {pointagesLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Employe</th>
                <th className="px-4 py-2">Arrivee</th>
                <th className="px-4 py-2">Depart</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visiblePointagesToday.map((p) => (
                <tr key={p.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${p.active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2">{employeeName(p.employeeId)}</td>
                  <td className="px-4 py-2">{formatHeure(p.heureArrivee)}</td>
                  <td className="px-4 py-2">{formatHeure(p.heureDepart)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openCorrect(p)}>Corriger</Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(p)}>
                        {p.active ? "Archiver" : "Reactiver"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pointagesLoading && visiblePointagesToday.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Aucun pointage pour aujourd'hui.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={correctingId !== null} onClose={() => setCorrectingId(null)}>
        <DialogHeader><DialogTitle>Corriger le pointage</DialogTitle></DialogHeader>
        <form onSubmit={handleCorrectSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="heureArrivee">Heure d'arrivee</Label>
            <Input
              id="heureArrivee"
              type="datetime-local"
              required
              value={correctForm.heureArrivee}
              onChange={(e) => setCorrectForm({ ...correctForm, heureArrivee: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="heureDepart">Heure de depart (optionnel)</Label>
            <Input
              id="heureDepart"
              type="datetime-local"
              value={correctForm.heureDepart}
              onChange={(e) => setCorrectForm({ ...correctForm, heureDepart: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCorrectingId(null)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
