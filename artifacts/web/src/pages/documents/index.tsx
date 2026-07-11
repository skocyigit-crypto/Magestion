import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TYPE_LABELS,
  downloadDocument,
  formatTaille,
  listDocuments,
  updateDocument,
  uploadDocument,
  type DocumentItem,
  type DocumentType,
} from "@/lib/documents";

function joursRestants(dateExpiration: string | null): number | null {
  if (!dateExpiration) return null;
  return Math.ceil((new Date(dateExpiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  // NB: le backend (routes/documents.ts) filtre en dur `active = true` sur
  // GET /documents et ne lit pas `onlyInactive` — cette case a cocher est
  // donc sans effet tant que le backend n'est pas corrige (voir lib/documents.ts).
  const { data: documents } = useQuery({
    queryKey: ["documents", showArchived],
    queryFn: () => listDocuments(showArchived),
  });

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [type, setType] = useState<DocumentType>("AUTRE");
  const [dateExpiration, setDateExpiration] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ nom: string; type: DocumentType; dateExpiration: string }>({
    nom: "",
    type: "AUTRE",
    dateExpiration: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const all = documents ?? [];
  const expirantBientot = all.filter((d) => {
    const j = joursRestants(d.dateExpiration);
    return j !== null && j <= 30;
  }).length;

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
      await uploadDocument(file, { type, dateExpiration: dateExpiration || undefined });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsUploadOpen(false);
      setDateExpiration("");
      setType("AUTRE");
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

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Taille</th>
                <th className="px-4 py-2">Expiration</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {all.map((d) => {
                const jours = joursRestants(d.dateExpiration);
                return (
                  <tr key={d.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${d.active ? "" : "opacity-60"}`}>
                    <td className="px-4 py-2">{d.nom}</td>
                    <td className="px-4 py-2">{TYPE_LABELS[d.type]}</td>
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
              {all.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun document pour le moment.</td></tr>
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
