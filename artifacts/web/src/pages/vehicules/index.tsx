import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CARBURANT_LABELS,
  STATUT_LABELS,
  TYPE_LABELS,
  createVehicle,
  listVehicles,
  updateVehicle,
  updateVehicleStatut,
  type Vehicle,
  type VehicleCarburant,
  type VehicleInput,
  type VehicleStatut,
  type VehicleType,
} from "@/lib/vehicles";

const EMPTY_FORM: VehicleInput = { immatriculation: "", type: "CAMIONNETTE" };
const STATUT_ORDER: VehicleStatut[] = ["DISPONIBLE", "EN_MISSION", "EN_MAINTENANCE", "HORS_SERVICE"];

export default function VehiculesPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles", showArchived],
    queryFn: () => listVehicles(showArchived),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const all = vehicles ?? [];
  const disponibles = all.filter((v) => v.statut === "DISPONIBLE").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (v) =>
        v.immatriculation.toLowerCase().includes(q) ||
        (v.marque ?? "").toLowerCase().includes(q) ||
        (v.modele ?? "").toLowerCase().includes(q),
    );
  }, [all, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setForm({
      immatriculation: vehicle.immatriculation,
      marque: vehicle.marque ?? undefined,
      modele: vehicle.modele ?? undefined,
      type: vehicle.type,
      carburant: vehicle.carburant,
      kilometrage: vehicle.kilometrage,
      dateAssuranceValidite: vehicle.dateAssuranceValidite ?? undefined,
      dateControleTechniqueValidite: vehicle.dateControleTechniqueValidite ?? undefined,
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateVehicle(editingId, form);
      } else {
        await createVehicle(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: VehicleStatut) {
    await updateVehicleStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  }

  async function handleToggleActive(vehicle: Vehicle) {
    await updateVehicle(vehicle.id, { active: !vehicle.active });
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Vehicules</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Ajouter un vehicule</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total vehicules</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Disponibles</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{disponibles}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (immatriculation, marque, modele)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v: Vehicle) => (
            <Card key={v.id} className={v.active ? undefined : "opacity-60"}>
              <CardHeader><CardTitle className="text-foreground">{v.immatriculation}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span>{v.marque} {v.modele} — {TYPE_LABELS[v.type]}</span>
                <span>{v.kilometrage.toLocaleString("fr-FR")} km</span>
                <select
                  className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                  value={v.statut}
                  onChange={(e) => handleStatutChange(v.id, e.target.value as VehicleStatut)}
                >
                  {STATUT_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(v)}>Modifier</Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggleActive(v)}>
                    {v.active ? "Archiver" : "Reactiver"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">Aucun vehicule pour le moment.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>{editingId ? "Modifier le vehicule" : "Ajouter un vehicule"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="immatriculation">Immatriculation</Label>
            <Input id="immatriculation" required value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="marque">Marque</Label>
              <Input id="marque" value={form.marque ?? ""} onChange={(e) => setForm({ ...form, marque: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modele">Modele</Label>
              <Input id="modele" value={form.modele ?? ""} onChange={(e) => setForm({ ...form, modele: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as VehicleType })}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="carburant">Carburant</Label>
              <select
                id="carburant"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.carburant ?? ""}
                onChange={(e) => setForm({ ...form, carburant: e.target.value as VehicleCarburant })}
              >
                <option value="">—</option>
                {Object.entries(CARBURANT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kilometrage">Kilometrage</Label>
            <Input
              id="kilometrage"
              type="number"
              min={0}
              value={form.kilometrage ?? 0}
              onChange={(e) => setForm({ ...form, kilometrage: Number(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateAssurance">Assurance — validite</Label>
              <Input
                id="dateAssurance"
                type="date"
                value={form.dateAssuranceValidite ?? ""}
                onChange={(e) => setForm({ ...form, dateAssuranceValidite: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateControle">Controle technique — validite</Label>
              <Input
                id="dateControle"
                type="date"
                value={form.dateControleTechniqueValidite ?? ""}
                onChange={(e) => setForm({ ...form, dateControleTechniqueValidite: e.target.value })}
              />
            </div>
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
