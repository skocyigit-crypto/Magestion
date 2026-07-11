import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FACTURE_STATUT_LABELS, changeFactureStatut, getFacture } from "@/lib/factures";
import { montantTtc } from "@/lib/devis";

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: facture, isLoading } = useQuery({ queryKey: ["factures", id], queryFn: () => getFacture(id) });

  async function handleTransition(statut: "ENVOYEE" | "PAYEE" | "EN_RETARD") {
    await changeFactureStatut(id, statut);
    await queryClient.invalidateQueries({ queryKey: ["factures", id] });
    await queryClient.invalidateQueries({ queryKey: ["factures"] });
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (!facture) return <Layout><p className="p-8 text-muted-foreground">Facture introuvable.</p></Layout>;

  const verrouillee = facture.statut !== "BROUILLON";

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{facture.numero}</h1>
            <p className="text-muted-foreground">{facture.client} — {facture.objet}</p>
          </div>
          <div className="flex gap-2">
            {facture.statut === "BROUILLON" && <Button onClick={() => handleTransition("ENVOYEE")}>Envoyer</Button>}
            {(facture.statut === "ENVOYEE" || facture.statut === "EN_RETARD") && (
              <Button onClick={() => handleTransition("PAYEE")}>Marquer payee</Button>
            )}
          </div>
        </div>

        {verrouillee && (
          <p className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            🔒 Facture emise — montant et objet verrouilles (regle de tracabilite financiere). Seul le statut peut encore evoluer.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Montant HT</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(facture.montantHt).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>TVA</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{facture.tauxTva} %</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant TTC</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{montantTtc(facture.montantHt, facture.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{FACTURE_STATUT_LABELS[facture.statut]}</p></CardContent>
          </Card>
        </div>

        {facture.devisId && (
          <p className="mt-4 text-sm text-muted-foreground">
            Generee depuis le devis <a href={`/devis/${facture.devisId}`} className="text-primary hover:underline">associe</a>.
          </p>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Une facture client ne peut jamais etre supprimee (tracabilite financiere) — seul l'archivage est possible.
        </p>
      </div>
    </Layout>
  );
}
