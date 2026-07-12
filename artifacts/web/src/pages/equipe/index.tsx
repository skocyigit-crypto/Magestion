import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  HABILITATION_TYPE_LABELS,
  ROLE_LABELS,
  STATUT_LABELS,
  createEmployee,
  listEcheancesRh,
  listEmployees,
  updateEmployee,
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
  const [showArchived, setShowArchived] = useState(false);
  const { data: employees, isLoading, isError } = useQuery({
    queryKey: ["employees", showArchived],
    queryFn: () => listEmployees(showArchived),
  });
  const { data: echeances } = useQuery({ queryKey: ["employees", "echeances"], queryFn: listEcheancesRh });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const all = employees ?? [];
  const surChantier = all.filter((e) => e.statut === "SUR_CHANTIER").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (e) => e.nom.toLowerCase().includes(q) || e.prenom.toLowerCase().includes(q),
    );
  }, [all, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingId(emp.id);
    setForm({
      nom: emp.nom,
      prenom: emp.prenom,
      role: emp.role,
      telephone: emp.telephone ?? undefined,
      email: emp.email ?? undefined,
      tauxHoraire: Number(emp.tauxHoraire),
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateEmployee(editingId, form);
      } else {
        await createEmployee(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: EmployeeStatut) {
    await updateEmployeeStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  async function handleToggleActive(emp: Employee) {
    await updateEmployee(emp.id, { active: !emp.active });
    await queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Equipe — RH</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Ajouter un employe</Button>
          </div>
        </div>

        {(echeances?.length ?? 0) > 0 && (
          <div className="mb-6 rounded-md border border-orange-900/50 bg-orange-950/20 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-orange-400">Echeances RH sous 30 jours</p>
            <div className="flex flex-col gap-1">
              {echeances!.map((e) => (
                <Link key={e.id} href={`/equipe/${e.employeeId}`} className="flex justify-between text-sm hover:underline">
                  <span className={e.expiree ? "text-red-400" : "text-foreground"}>
                    {e.employeeNom} — {HABILITATION_TYPE_LABELS[e.type]}{e.libelle ? ` (${e.libelle})` : ""}
                  </span>
                  <span className={e.expiree ? "text-red-400" : "text-orange-400"}>
                    {e.expiree ? `Expiree depuis ${-e.joursRestants} j` : `Dans ${e.joursRestants} j`}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

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

        <Input
          placeholder="Rechercher (nom, prenom)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((emp: Employee) => (
            <Card key={emp.id} className={emp.active ? undefined : "opacity-60"}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: emp.couleur }} />
                  <CardTitle className="text-foreground">
                    <Link href={`/equipe/${emp.id}`} className="hover:underline">{emp.prenom} {emp.nom}</Link>
                  </CardTitle>
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(emp)}>Modifier</Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggleActive(emp)}>
                    {emp.active ? "Archiver" : "Reactiver"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && !isError && filtered.length === 0 && <p className="text-muted-foreground">Aucun employe pour le moment.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingId ? "Modifier l'employe" : "Ajouter un employe"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
