import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  STATUT_LABELS,
  TYPE_LABELS,
  createVehicle,
  listVehicles,
  updateVehicleStatut,
  type Vehicle,
  type VehicleInput,
  type VehicleStatut,
  type VehicleType,
} from "@/lib/vehicles";

const EMPTY_FORM: VehicleInput = { immatriculation: "", type: "CAMIONNETTE" };
const STATUT_ORDER: VehicleStatut[] = ["DISPONIBLE", "EN_MISSION", "EN_MAINTENANCE", "HORS_SERVICE"];

export default function VehiculesPage() {
  const queryClient = useQueryClient();
  const { data: vehicles } = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<VehicleInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = vehicles ?? [];
  const disponibles = all.filter((v) => v.statut === "DISPONIBLE").length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createVehicle(form);
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: VehicleStatut) {
    await updateVehicleStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Vehicules</h1>
          <Button onClick={() => setIsOpen(true)}>Ajouter un vehicule</Button>
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {all.map((v: Vehicle) => (
            <Card key={v.id}>
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
              </CardContent>
            </Card>
          ))}
          {all.length === 0 && <p className="text-muted-foreground">Aucun vehicule pour le moment.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Ajouter un vehicule</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
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
