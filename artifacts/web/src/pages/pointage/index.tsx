import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listEmployees } from "@/lib/employees";
import { listPointage, pointerArrivee, pointerDepart } from "@/lib/pointage";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PointagePage() {
  const queryClient = useQueryClient();
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: listEmployees });
  const { data: pointages } = useQuery({ queryKey: ["pointage"], queryFn: listPointage });

  const today = todayStr();
  const pointagesToday = (pointages ?? []).filter((p) => p.dateJour === today);
  const present = pointagesToday.filter((p) => !p.heureDepart).length;

  function openPointageFor(employeeId: string) {
    return pointagesToday.find((p) => p.employeeId === employeeId && !p.heureDepart);
  }

  async function handleArrivee(employeeId: string) {
    await pointerArrivee(employeeId);
    await queryClient.invalidateQueries({ queryKey: ["pointage"] });
  }

  async function handleDepart(id: string) {
    await pointerDepart(id);
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
                  {open && <span className="text-xs text-muted-foreground">arrive a {new Date(open.heureArrivee).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
                {open ? (
                  <Button size="sm" variant="outline" onClick={() => handleDepart(open.id)}>Pointer depart</Button>
                ) : (
                  <Button size="sm" onClick={() => handleArrivee(emp.id)}>Pointer arrivee</Button>
                )}
              </div>
            );
          })}
          {(employees ?? []).length === 0 && (
            <p className="text-muted-foreground">Ajoutez des employes dans Equipe pour commencer le pointage.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
