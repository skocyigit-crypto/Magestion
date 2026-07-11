import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listEmployees } from "@/lib/employees";
import { listProjects } from "@/lib/projects";
import {
  TYPE_LABELS,
  createAffectation,
  listAffectations,
  retirerAffectation,
  startOfWeek,
  toDateStr,
  type Affectation,
  type AffectationType,
} from "@/lib/planningPersonnel";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function PlanningPersonnelPage() {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart],
  );
  const debut = toDateStr(weekDays[0]);
  const fin = toDateStr(weekDays[6]);

  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: listEmployees });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: affectations } = useQuery({ queryKey: ["planning-personnel", debut, fin], queryFn: () => listAffectations(debut, fin) });

  const [modalCell, setModalCell] = useState<{ employeeId: string; date: string } | null>(null);
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState<AffectationType>("CHANTIER");
  const [chefEquipe, setChefEquipe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function findAffectation(employeeId: string, date: string): Affectation | undefined {
    return (affectations ?? []).find((a) => a.employeeId === employeeId && a.date === date);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!modalCell) return;
    setError(null);
    try {
      await createAffectation({ employeeId: modalCell.employeeId, date: modalCell.date, projectId: projectId || undefined, type, chefEquipe });
      await queryClient.invalidateQueries({ queryKey: ["planning-personnel"] });
      setModalCell(null);
      setProjectId("");
      setType("CHANTIER");
      setChefEquipe(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleRemove(id: string) {
    await retirerAffectation(id);
    await queryClient.invalidateQueries({ queryKey: ["planning-personnel"] });
  }

  const projectNom = (id: string | null) => (projects ?? []).find((p) => p.id === id)?.nom ?? "";

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Planning Personnel</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>Semaine precedente</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Aujourd'hui</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>Semaine suivante</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Employes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{(employees ?? []).length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Affectations cette semaine</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{(affectations ?? []).length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Chefs d'equipe assignes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{(affectations ?? []).filter((a) => a.chefEquipe).length}</p></CardContent>
          </Card>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2">Employe</th>
                {weekDays.map((d, i) => (
                  <th key={i} className="px-3 py-2">{JOURS[i]} {d.getDate()}/{d.getMonth() + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(employees ?? []).map((emp) => (
                <tr key={emp.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: emp.couleur }} />
                    {emp.prenom} {emp.nom}
                  </td>
                  {weekDays.map((d, i) => {
                    const date = toDateStr(d);
                    const affectation = findAffectation(emp.id, date);
                    return (
                      <td key={i} className="px-1 py-1">
                        {affectation ? (
                          <button
                            className="w-full rounded px-2 py-1 text-left text-xs text-white"
                            style={{ backgroundColor: affectation.type === "CHANTIER" ? emp.couleur : "#334155" }}
                            onClick={() => handleRemove(affectation.id)}
                            title="Cliquer pour retirer"
                          >
                            {affectation.type === "CHANTIER" ? projectNom(affectation.projectId) || "Chantier" : TYPE_LABELS[affectation.type]}
                            {affectation.chefEquipe && " (CE)"}
                          </button>
                        ) : (
                          <button
                            className="w-full rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary"
                            onClick={() => setModalCell({ employeeId: emp.id, date })}
                          >
                            +
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {(employees ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Ajoutez des employes dans Equipe pour commencer.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!modalCell} onClose={() => setModalCell(null)}>
        <DialogHeader>
          <DialogTitle>Nouvelle affectation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAssign} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as AffectationType)}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {type === "CHANTIER" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="projectId">Chantier</Label>
              <select
                id="projectId"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">—</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>
          )}
          {type === "CHANTIER" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={chefEquipe} onChange={(e) => setChefEquipe(e.target.checked)} />
              Chef d'equipe pour cette affectation
            </label>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalCell(null)}>Annuler</Button>
            <Button type="submit">Assigner</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
