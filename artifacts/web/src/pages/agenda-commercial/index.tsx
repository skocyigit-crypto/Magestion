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
  createAgendaEvent,
  listAgenda,
  updateAgendaEvent,
  updateAgendaStatut,
  type AgendaEvent,
  type AgendaStatut,
  type AgendaType,
} from "@/lib/agenda";

const EMPTY_FORM = { titre: "", type: "RDV" as AgendaType, dateHeure: "", dureeMinutes: 60 };

function fmtDateHeure(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AgendaCommercialPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: events } = useQuery({
    queryKey: ["agenda", showArchived],
    queryFn: () => listAgenda(showArchived),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = (events ?? []).slice().sort((a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime());
  const aVenir = all.filter((e) => new Date(e.dateHeure) > new Date() && e.statut !== "ANNULE").length;
  const aujourdhui = all.filter((e) => new Date(e.dateHeure).toDateString() === new Date().toDateString()).length;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(ev: AgendaEvent) {
    setEditingId(ev.id);
    setForm({
      titre: ev.titre,
      type: ev.type,
      dateHeure: toDatetimeLocalValue(ev.dateHeure),
      dureeMinutes: ev.dureeMinutes,
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateAgendaEvent(editingId, form);
      } else {
        await createAgendaEvent(form);
      }
      await queryClient.invalidateQueries({ queryKey: ["agenda"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatutChange(id: string, statut: AgendaStatut) {
    await updateAgendaStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  async function handleToggleActive(ev: AgendaEvent) {
    await updateAgendaEvent(ev.id, { active: !ev.active });
    await queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Agenda commercial</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={openCreate}>Nouveau rendez-vous</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total evenements</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Aujourd'hui</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{aujourdhui}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>A venir</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{aVenir}</p></CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          {all.map((ev: AgendaEvent) => (
            <div key={ev.id} className={`flex items-center justify-between rounded-lg border border-border px-4 py-3 ${ev.active ? "" : "opacity-60"}`}>
              <div>
                <p className="font-medium">{ev.titre}</p>
                <p className="text-sm text-muted-foreground">{TYPE_LABELS[ev.type]} — {fmtDateHeure(ev.dateHeure)} ({ev.dureeMinutes} min)</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                  value={ev.statut}
                  onChange={(e) => handleStatutChange(ev.id, e.target.value as AgendaStatut)}
                >
                  {Object.entries(STATUT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => openEdit(ev)}>Modifier</Button>
                <Button variant="outline" size="sm" onClick={() => handleToggleActive(ev)}>
                  {ev.active ? "Archiver" : "Reactiver"}
                </Button>
              </div>
            </div>
          ))}
          {all.length === 0 && <p className="text-muted-foreground">Aucun evenement planifie.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>{editingId ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titre">Titre</Label>
            <Input id="titre" required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AgendaType })}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dureeMinutes">Duree (min)</Label>
              <Input
                id="dureeMinutes"
                type="number"
                min={5}
                value={form.dureeMinutes}
                onChange={(e) => setForm({ ...form, dureeMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateHeure">Date et heure</Label>
            <Input id="dateHeure" type="datetime-local" required value={form.dateHeure} onChange={(e) => setForm({ ...form, dateHeure: e.target.value })} />
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
