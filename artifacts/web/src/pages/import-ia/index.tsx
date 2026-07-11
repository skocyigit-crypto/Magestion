import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyserFactureDepense } from "@/lib/aiImport";
import { createDepense, type DepenseInput } from "@/lib/depenses";

const EMPTY_FORM: DepenseInput = { fournisseur: "", objet: "", montantHt: 0, tauxTva: 20 };

export default function ImportIaPage() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [form, setForm] = useState<DepenseInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange() {
    const file = fileInputRef.current?.files?.[0];
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setAnalyzed(false);
    setError(null);
  }

  async function handleAnalyser() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selectionnez une photo ou un scan de facture");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const extracted = await analyserFactureDepense(file);
      setForm({
        fournisseur: extracted.fournisseur ?? "",
        objet: extracted.objet ?? "",
        montantHt: extracted.montantHt ?? 0,
        tauxTva: (extracted.tauxTva as DepenseInput["tauxTva"]) ?? 20,
        dateEcheance: extracted.dateEcheance ?? undefined,
      });
      setAnalyzed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleCreer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDepense(form);
      navigate("/depenses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-semibold">Import IA — Facture fournisseur</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Televersez une photo ou un scan de facture fournisseur : l'IA (Gemini) extrait automatiquement
          fournisseur, objet, montant HT, TVA et date d'echeance. Verifiez et corrigez avant de creer la depense.
        </p>

        <Card className="mb-6">
          <CardHeader><CardTitle>1. Televerser</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="text-sm" />
            {previewUrl && (
              <img src={previewUrl} alt="Apercu facture" className="max-h-64 rounded-md border border-border object-contain" />
            )}
            <Button onClick={handleAnalyser} disabled={analyzing}>
              {analyzing ? "Analyse en cours..." : "Analyser avec l'IA"}
            </Button>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </CardContent>
        </Card>

        {analyzed && (
          <Card>
            <CardHeader><CardTitle>2. Verifier et creer la depense</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreer} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fournisseur">Fournisseur</Label>
                  <Input id="fournisseur" required value={form.fournisseur} onChange={(e) => setForm({ ...form, fournisseur: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="objet">Objet</Label>
                  <Input id="objet" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="montantHt">Montant HT (€)</Label>
                    <Input
                      id="montantHt"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.montantHt}
                      onChange={(e) => setForm({ ...form, montantHt: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tauxTva">TVA</Label>
                    <select
                      id="tauxTva"
                      className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                      value={form.tauxTva}
                      onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) as DepenseInput["tauxTva"] })}
                    >
                      {[0, 5.5, 10, 20].map((t) => (
                        <option key={t} value={t}>{t} %</option>
                      ))}
                    </select>
                  </div>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer la depense"}</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
