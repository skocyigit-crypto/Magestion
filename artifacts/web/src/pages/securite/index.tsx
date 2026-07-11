import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GRAVITE_COLORS,
  GRAVITE_LABELS,
  createIncident,
  listIncidents,
  updateIncident,
  type Gravite,
  type Incident,
  type IncidentInput,
} from "@/lib/securite";

const EMPTY_FORM: IncidentInput = { titre: "", typeIncident: "", gravite: "FAIBLE" };

export default function SecuritePage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: incidents, isLoading } = useQuery({
    queryKey: ["securite", showArchived],
    queryFn: () => listIncidents(showArchived),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IncidentInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const all = incidents ?? [];
  const critiques = all.filter((i) => i.gravite === "CRITIQUE" || i.gravite === "ELEVEE").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (i) => i.titre.toLowerCase().includes(q) || i.typeIncident.toLowerCase().includes(q),
    );
  }, [all, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(incident: Incident) {
    setEditingId(incident.id);
    setForm({
      titre: incident.titre,
      typeIncident: incident.typeIncident,
      gravite: incident.gravite,
      description: incident.description ?? undefined,
      projectId: incident.projectId ?? undefined,
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateIncident(editingId, form);
      } else {
        await createIncident(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["securite"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(incident: Incident) {
    await updateIncident(incident.id, { active: !incident.active });
    await queryClient.invalidateQueries({ queryKey: ["securite"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Securite — Incidents</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Signaler un incident</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total incidents</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Elevee/Critique</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${critiques > 0 ? "text-red-400" : ""}`}>{critiques}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (titre, type d'incident)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="flex flex-col gap-2">
          {filtered.map((i) => (
            <div key={i.id} className={`rounded-lg border border-border p-4 ${i.active ? "" : "opacity-60"}`}>
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium">{i.titre}</p>
                <span className={`text-sm font-semibold ${GRAVITE_COLORS[i.gravite]}`}>{GRAVITE_LABELS[i.gravite]}</span>
              </div>
              <p className="text-sm text-muted-foreground">{i.typeIncident}</p>
              {i.description && <p className="mt-1 text-sm">{i.description}</p>}
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(i)}>Modifier</Button>
                <Button variant="outline" size="sm" onClick={() => handleToggleActive(i)}>
                  {i.active ? "Archiver" : "Reactiver"}
                </Button>
              </div>
            </div>
          ))}
          {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">Aucun incident signale.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingId ? "Modifier l'incident" : "Signaler un incident"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titre">Titre</Label>
            <Input id="titre" required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="typeIncident">Type d'incident</Label>
            <Input id="typeIncident" required value={form.typeIncident} onChange={(e) => setForm({ ...form, typeIncident: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gravite">Gravite</Label>
            <select
              id="gravite"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.gravite}
              onChange={(e) => setForm({ ...form, gravite: e.target.value as Gravite })}
            >
              {Object.entries(GRAVITE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="min-h-20 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Signaler"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
