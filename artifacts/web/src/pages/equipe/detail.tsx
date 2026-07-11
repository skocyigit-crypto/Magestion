import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS, STATUT_LABELS, getEmployee } from "@/lib/employees";
import { listPointage } from "@/lib/pointage";
import { TYPE_LABELS, listAffectations, startOfWeek, toDateStr } from "@/lib/planningPersonnel";
import { listProjects } from "@/lib/projects";

function formatHeure(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: employee, isLoading, isError } = useQuery({ queryKey: ["employees", id], queryFn: () => getEmployee(id) });
  const { data: pointages } = useQuery({ queryKey: ["pointage"], queryFn: listPointage });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

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
      </div>
    </Layout>
  );
}
