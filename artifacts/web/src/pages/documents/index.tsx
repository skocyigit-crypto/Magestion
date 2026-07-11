import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TYPE_LABELS, downloadDocument, formatTaille, listDocuments, uploadDocument, type DocumentType } from "@/lib/documents";

function joursRestants(dateExpiration: string | null): number | null {
  if (!dateExpiration) return null;
  return Math.ceil((new Date(dateExpiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const { data: documents } = useQuery({ queryKey: ["documents"], queryFn: listDocuments });

  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<DocumentType>("AUTRE");
  const [dateExpiration, setDateExpiration] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setIsOpen(false);
      setDateExpiration("");
      setType("AUTRE");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Documents</h1>
          <Button onClick={() => setIsOpen(true)}>Televerser un document</Button>
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
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{d.nom}</td>
                    <td className="px-4 py-2">{TYPE_LABELS[d.type]}</td>
                    <td className="px-4 py-2">{formatTaille(d.tailleOctets)}</td>
                    <td className={`px-4 py-2 ${jours !== null && jours <= 30 ? "text-orange-400" : ""}`}>{d.dateExpiration ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Button size="sm" variant="outline" onClick={() => downloadDocument(d.id, d.nom)}>Telecharger</Button>
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

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
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
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Envoi..." : "Televerser"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
