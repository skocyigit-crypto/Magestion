import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ROLE_LABELS,
  STATUT_LABELS,
  createEmployee,
  listEmployees,
  updateEmployeeStatut,
  type Employee,
  type EmployeeInput,
  type EmployeeRole,
  type EmployeeStatut,
} from "@/lib/employees";

const EMPTY_FORM: EmployeeInput = { nom: "", prenom: "", role: "AUTRE", tauxHoraire: 0 };
const STATUT_ORDER: EmployeeStatut[] = ["SUR_CHANTIER", "EN_ROUTE", "ABSENT", "INDISPONIBLE", "CONGE"];

export default function EquipePage() {
  const queryClient = useQueryClient();
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: listEmployees });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<EmployeeInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = employees ?? [];
  const surChantier = all.filter((e) => e.statut === "SUR_CHANTIER").length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createEmployee(form);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: EmployeeStatut) {
    await updateEmployeeStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Equipe — RH</h1>
          <Button onClick={() => setIsOpen(true)}>Ajouter un employe</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total employes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Sur chantier</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{surChantier}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Absents</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.filter((e) => e.statut === "ABSENT").length}</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {all.map((emp: Employee) => (
            <Card key={emp.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: emp.couleur }} />
                  <CardTitle className="text-foreground">{emp.prenom} {emp.nom}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span>{ROLE_LABELS[emp.role]}</span>
                <select
                  className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                  value={emp.statut}
                  onChange={(e) => handleStatutChange(emp.id, e.target.value as EmployeeStatut)}
                >
                  {STATUT_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                  ))}
                </select>
              </CardContent>
            </Card>
          ))}
          {all.length === 0 && <p className="text-muted-foreground">Aucun employe pour le moment.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Ajouter un employe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prenom">Prenom</Label>
              <Input id="prenom" required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as EmployeeRole })}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telephone">Telephone</Label>
              <Input id="telephone" value={form.telephone ?? ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tauxHoraire">Taux horaire (€)</Label>
              <Input
                id="tauxHoraire"
                type="number"
                min={0}
                value={form.tauxHoraire}
                onChange={(e) => setForm({ ...form, tauxHoraire: Number(e.target.value) })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
