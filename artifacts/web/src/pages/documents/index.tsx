import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ENTITY_TYPE_LABELS,
  TYPE_LABELS,
  downloadDocument,
  formatTaille,
  listDocuments,
  updateDocument,
  uploadDocument,
  type DocumentItem,
  type DocumentType,
  type EntityType,
} from "@/lib/documents";
import { listProjects } from "@/lib/projects";
import { listEmployees } from "@/lib/employees";
import { listVehicles } from "@/lib/vehicles";
import { listSousTraitants } from "@/lib/sousTraitants";

function joursRestants(dateExpiration: string | null): number | null {
  if (!dateExpiration) return null;
  return Math.ceil((new Date(dateExpiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

interface EntityForm {
  entityType: EntityType;
  entityId: string;
}

const EMPTY_ENTITY: EntityForm = { entityType: "GENERAL", entityId: "" };

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", showArchived],
    queryFn: () => listDocuments(showArchived),
  });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const { data: vehicles } = useQuery({ queryKey: ["vehicles"], queryFn: () => listVehicles() });
  const { data: sousTraitants } = useQuery({ queryKey: ["sous-traitants"], queryFn: () => listSousTraitants() });

  function entityOptions(entityType: EntityType): { id: string; label: string }[] {
    switch (entityType) {
      case "PROJECT": return (projects ?? []).map((p) => ({ id: p.id, label: p.nom }));
      case "EMPLOYEE": return (employees ?? []).map((e) => ({ id: e.id, label: `${e.prenom} ${e.nom}` }));
      case "VEHICLE": return (vehicles ?? []).map((v) => ({ id: v.id, label: v.immatriculation }));
      case "SOUS_TRAITANT": return (sousTraitants ?? []).map((s) => ({ id: s.id, label: s.raisonSociale }));
      default: return [];
    }
  }

  function entityLabel(d: DocumentItem): string {
    if (d.entityType === "GENERAL" || !d.entityId) return "General";
    const opt = entityOptions(d.entityType).find((o) => o.id === d.entityId);
    return `${ENTITY_TYPE_LABELS[d.entityType]} — ${opt?.label ?? "?"}`;
  }

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [type, setType] = useState<DocumentType>("AUTRE");
  const [dateExpiration, setDateExpiration] = useState("");
  const [entityForm, setEntityForm] = useState<EntityForm>(EMPTY_ENTITY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ nom: string; type: DocumentType; dateExpiration: string }>({
    nom: "",
    type: "AUTRE",
    dateExpiration: "",
  });
  const [editEntityForm, setEditEntityForm] = useState<EntityForm>(EMPTY_ENTITY);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterEntityType, setFilterEntityType] = useState<EntityType | "TOUS">("TOUS");
  const all = documents ?? [];
  const expirantBientot = all.filter((d) => {
    const j = joursRestants(d.dateExpiration);
    return j !== null && j <= 30;
  }).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((d) => {
      const matchesSearch = !q || d.nom.toLowerCase().includes(q);
      const matchesEntity = filterEntityType === "TOUS" || d.entityType === filterEntityType;
      return matchesSearch && matchesEntity;
    });
  }, [all, search, filterEntityType]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selectionnez un fichier");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await uploadDocument(file, {
        type,
        dateExpiration: dateExpiration || undefined,
        entityType: entityForm.entityType,
        entityId: entityForm.entityId || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsUploadOpen(false);
      setDateExpiration("");
      setType("AUTRE");
      setEntityForm(EMPTY_ENTITY);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(d: DocumentItem) {
    setEditingId(d.id);
    setEditForm({ nom: d.nom, type: d.type, dateExpiration: d.dateExpiration ?? "" });
    setEditEntityForm({ entityType: d.entityType, entityId: d.entityId ?? "" });
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateDocument(editingId, {
        nom: editForm.nom,
        type: editForm.type,
        entityType: editEntityForm.entityType,
        ...(editEntityForm.entityId ? { entityId: editEntityForm.entityId } : {}),
        ...(editForm.dateExpiration ? { dateExpiration: editForm.dateExpiration } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(d: DocumentItem) {
    await updateDocument(d.id, { active: !d.active });
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Documents</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Afficher les archives
            </label>
            <Button onClick={() => setIsUploadOpen(true)}>Televerser un document</Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total documents</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Expirent sous 30 jours</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${expirantBientot > 0 ? "text-orange-400" : ""}`}>{expirantBientot}</p></CardContent>
          </Card>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            placeholder="Rechercher (nom)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
            value={filterEntityType}
            onChange={(e) => setFilterEntityType(e.target.value as EntityType | "TOUS")}
          >
            <option value="TOUS">Tous les rattachements</option>
            {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Rattache a</th>
                <th className="px-4 py-2">Taille</th>
                <th className="px-4 py-2">Expiration</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const jours = joursRestants(d.dateExpiration);
                return (
                  <tr key={d.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${d.active ? "" : "opacity-60"}`}>
                    <td className="px-4 py-2">{d.nom}</td>
                    <td className="px-4 py-2">{TYPE_LABELS[d.type]}</td>
                    <td className="px-4 py-2 text-muted-foreground">{entityLabel(d)}</td>
                    <td className="px-4 py-2">{formatTaille(d.tailleOctets)}</td>
                    <td className={`px-4 py-2 ${jours !== null && jours <= 30 ? "text-orange-400" : ""}`}>{d.dateExpiration ?? "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => downloadDocument(d.id, d.nom)}>Telecharger</Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(d)}>Modifier</Button>
                        <Button size="sm" variant="outline" onClick={() => handleToggleActive(d)}>
                          {d.active ? "Archiver" : "Reactiver"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun document pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isUploadOpen} onClose={() => setIsUploadOpen(false)}>
        <DialogHeader><DialogTitle>Televerser un document</DialogTitle></DialogHeader>
        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">Fichier</Label>
            <input id="file" ref={fileInputRef} type="file" className="text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entityType">Rattache a</Label>
              <select
                id="entityType"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={entityForm.entityType}
                onChange={(e) => setEntityForm({ entityType: e.target.value as EntityType, entityId: "" })}
              >
                {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {entityForm.entityType !== "GENERAL" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="entityId">{ENTITY_TYPE_LABELS[entityForm.entityType]}</Label>
                <select
                  id="entityId"
                  className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                  value={entityForm.entityId}
                  onChange={(e) => setEntityForm({ ...entityForm, entityId: e.target.value })}
                >
                  <option value="">—</option>
                  {entityOptions(entityForm.entityType).map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateExpiration">Date d'expiration (optionnel)</Label>
            <Input id="dateExpiration" type="date" value={dateExpiration} onChange={(e) => setDateExpiration(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Envoi..." : "Televerser"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={editingId !== null} onClose={() => setEditingId(null)}>
        <DialogHeader><DialogTitle>Modifier le document</DialogTitle></DialogHeader>
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editNom">Nom</Label>
            <Input
              id="editNom"
              required
              value={editForm.nom}
              onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editType">Type</Label>
            <select
              id="editType"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={editForm.type}
              onChange={(e) => setEditForm({ ...editForm, type: e.target.value as DocumentType })}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editEntityType">Rattache a</Label>
              <select
                id="editEntityType"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={editEntityForm.entityType}
                onChange={(e) => setEditEntityForm({ entityType: e.target.value as EntityType, entityId: "" })}
              >
                {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {editEntityForm.entityType !== "GENERAL" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editEntityId">{ENTITY_TYPE_LABELS[editEntityForm.entityType]}</Label>
                <select
                  id="editEntityId"
                  className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                  value={editEntityForm.entityId}
                  onChange={(e) => setEditEntityForm({ ...editEntityForm, entityId: e.target.value })}
                >
                  <option value="">—</option>
                  {entityOptions(editEntityForm.entityType).map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editDateExpiration">Date d'expiration (optionnel)</Label>
            <Input
              id="editDateExpiration"
              type="date"
              value={editForm.dateExpiration}
              onChange={(e) => setEditForm({ ...editForm, dateExpiration: e.target.value })}
            />
          </div>
          {editError && <p className="text-sm text-red-400">{editError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Annuler</Button>
            <Button type="submit" disabled={editSaving}>{editSaving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
