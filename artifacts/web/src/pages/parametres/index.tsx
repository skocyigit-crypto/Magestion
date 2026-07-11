import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getParametres, updateParametres, type ParametresInput } from "@/lib/parametres";

const EMPTY_FORM: ParametresInput = { nom: "" };

export default function ParametresPage() {
  const { data: parametres, refetch } = useQuery({ queryKey: ["parametres"], queryFn: getParametres });

  const [form, setForm] = useState<ParametresInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!parametres) return;
    setForm({
      nom: parametres.nom,
      siret: parametres.siret ?? undefined,
      adresse: parametres.adresse ?? undefined,
      codePostal: parametres.codePostal ?? undefined,
      ville: parametres.ville ?? undefined,
      email: parametres.email ?? undefined,
      telephone: parametres.telephone ?? undefined,
      tvaIntracommunautaire: parametres.tvaIntracommunautaire ?? undefined,
    });
  }, [parametres]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateParametres(form);
      await refetch();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-semibold">Parametres de l'entreprise</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Ces informations apparaissent sur les devis/factures PDF et comme expediteur des emails. Le SIRET est utilise pour l'export FEC.
        </p>

        <Card>
          <CardHeader><CardTitle>Coordonnees legales</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nom">Raison sociale</Label>
                  <Input id="nom" required value={form.nom ?? ""} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input id="siret" value={form.siret ?? ""} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adresse">Adresse</Label>
                <Input id="adresse" value={form.adresse ?? ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="codePostal">Code postal</Label>
                  <Input id="codePostal" value={form.codePostal ?? ""} onChange={(e) => setForm({ ...form, codePostal: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ville">Ville</Label>
                  <Input id="ville" value={form.ville ?? ""} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="telephone">Telephone</Label>
                  <Input id="telephone" value={form.telephone ?? ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tvaIntracommunautaire">TVA intracommunautaire (optionnel)</Label>
                <Input
                  id="tvaIntracommunautaire"
                  value={form.tvaIntracommunautaire ?? ""}
                  onChange={(e) => setForm({ ...form, tvaIntracommunautaire: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              {success && <p className="text-sm text-emerald-400">Enregistre.</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
