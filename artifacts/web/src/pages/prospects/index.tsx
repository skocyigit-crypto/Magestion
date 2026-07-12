import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PIPELINE_STAGES,
  STATUT_LABELS,
  URGENCE_LABELS,
  createProspect,
  listProspects,
  updateProspect,
  type Prospect,
  type ProspectInput,
  type ProspectStatut,
  type ProspectUrgence,
} from "@/lib/prospects";

const EMPTY_FORM: ProspectInput = { nom: "", contact: "", telephone: "", email: "", budgetEstime: 0, distanceKm: undefined, urgence: "NORMALE" };

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-primary";
  return "text-muted-foreground";
}

export default function ProspectsPage() {
  const queryClient = useQueryClient();
  const { data: prospects, isLoading, isError } = useQuery({ queryKey: ["prospects"], queryFn: listProspects });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ProspectInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ProspectStatut | null>(null);
  const [search, setSearch] = useState("");

  const all = prospects ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) => p.nom.toLowerCase().includes(q) || (p.contact ?? "").toLowerCase().includes(q),
    );
  }, [all, search]);

  const byStage = (stage: ProspectStatut) => filtered.filter((p) => p.statut === stage);

  const budgetPipeline = all
    .filter((p) => p.statut !== "PERDU" && p.statut !== "GAGNE")
    .reduce((sum, p) => sum + Number(p.budgetEstime), 0);
  const closes = all.filter((p) => p.statut === "GAGNE" || p.statut === "PERDU").length;
  const gagnes = all.filter((p) => p.statut === "GAGNE").length;
  const tauxConversion = closes > 0 ? Math.round((gagnes / closes) * 100) : null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createProspect(form);
      await queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la creation";
      // Doublon detecte (409) : proposer de creer quand meme plutot que bloquer.
      if (message.includes("existe deja") && confirm(`${message}\n\nCreer quand meme ?`)) {
        try {
          await createProspect(form, true);
          await queryClient.invalidateQueries({ queryKey: ["prospects"] });
          setIsOpen(false);
          setForm(EMPTY_FORM);
          return;
        } catch (err2) {
          setError(err2 instanceof Error ? err2.message : "Erreur lors de la creation");
          return;
        }
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function moveToStage(prospectId: string, statut: ProspectStatut) {
    // PERDU exige un motif — gere uniquement depuis la fiche detail (dialog dediee).
    if (statut === "PERDU") {
      alert("Renseignez le motif de perte depuis la fiche du prospect.");
      return;
    }
    await updateProspect(prospectId, { statut });
    await queryClient.invalidateQueries({ queryKey: ["prospects"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Prospects — Pipeline commercial</h1>
          <Button onClick={() => setIsOpen(true)}>Nouveau prospect</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total prospects</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Budget pipeline (en cours)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{budgetPipeline.toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Taux de conversion</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{tauxConversion !== null ? `${tauxConversion} %` : "—"}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (nom, contact)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="mb-4 text-muted-foreground">Chargement...</p>}

        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage}
              className={`w-72 shrink-0 rounded-lg border p-3 ${dragOverStage === stage ? "border-primary bg-muted/30" : "border-border"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/prospect-id");
                setDragOverStage(null);
                if (id) moveToStage(id, stage);
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{STATUT_LABELS[stage]}</h2>
                <span className="text-xs text-muted-foreground">{byStage(stage).length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {byStage(stage).map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/prospect-id", p.id)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <Link href={`/prospects/${p.id}`}>
                      <Card className="p-3 hover:border-primary">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{p.nom}</p>
                          <span className={`text-xs font-semibold ${scoreColor(p.score)}`}>{p.score}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Number(p.budgetEstime).toLocaleString("fr-FR")} € — {URGENCE_LABELS[p.urgence]}
                        </p>
                      </Card>
                    </Link>
                  </div>
                ))}
                {!isLoading && !isError && byStage(stage).length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun prospect</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom / Societe</Label>
            <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact">Contact</Label>
              <Input id="contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telephone">Telephone</Label>
              <Input id="telephone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget">Budget estime (€)</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                value={form.budgetEstime}
                onChange={(e) => setForm({ ...form, budgetEstime: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="urgence">Urgence</Label>
              <select
                id="urgence"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.urgence}
                onChange={(e) => setForm({ ...form, urgence: e.target.value as ProspectUrgence })}
              >
                {Object.entries(URGENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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
