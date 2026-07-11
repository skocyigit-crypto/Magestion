import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DEVIS_STATUT_LABELS, changeDevisStatut, convertirEnFacture, getDevis, montantTtc } from "@/lib/devis";

export default function DevisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: devis, isLoading } = useQuery({ queryKey: ["devis", id], queryFn: () => getDevis(id) });
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTransition(statut: "ENVOYE" | "ACCEPTE" | "REFUSE") {
    await changeDevisStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["devis", id] });
    await queryClient.invalidateQueries({ queryKey: ["devis"] });
  }

  async function handleConvertir() {
    setConverting(true);
    setError(null);
    try {
      const facture = await convertirEnFacture(id);
      navigate(`/factures/${facture.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la conversion");
    } finally {
      setConverting(false);
    }
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (!devis) return <Layout><p className="p-8 text-muted-foreground">Devis introuvable.</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{devis.numero}</h1>
            <p className="text-muted-foreground">{devis.client} — {devis.objet}</p>
          </div>
          <div className="flex gap-2">
            {devis.statut === "BROUILLON" && <Button onClick={() => handleTransition("ENVOYE")}>Envoyer</Button>}
            {devis.statut === "ENVOYE" && (
              <>
                <Button variant="outline" onClick={() => handleTransition("REFUSE")}>Marquer refuse</Button>
                <Button onClick={() => handleTransition("ACCEPTE")}>Marquer accepte</Button>
              </>
            )}
            {devis.statut === "ACCEPTE" && (
              <Button onClick={handleConvertir} disabled={converting}>
                {converting ? "Conversion..." : "Convertir en facture"}
              </Button>
            )}
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Montant HT</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(devis.montantHt).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>TVA</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{devis.tauxTva} %</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant TTC</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{montantTtc(devis.montantHt, devis.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{DEVIS_STATUT_LABELS[devis.statut]}</p></CardContent>
          </Card>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Un devis ne peut jamais etre supprime (tracabilite financiere) — seul l'archivage est possible.
        </p>
      </div>
    </Layout>
  );
}
