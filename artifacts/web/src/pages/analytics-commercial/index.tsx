import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsCommercial } from "@/lib/analyticsCommercial";

export default function AnalyticsCommercialPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["analytics-commercial"], queryFn: getAnalyticsCommercial });

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-semibold">Performance commerciale</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Vue globale (pas de repartition par commercial — aucun champ d'affectation n'existe encore sur les
          prospects/devis).
        </p>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        {data && (
          <>
            <h2 className="mb-3 text-lg font-semibold">Prospects</h2>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card>
                <CardHeader><CardTitle>Total actifs</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{data.prospects.total}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Taux de conversion</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{data.prospects.tauxConversionPercent ?? "—"}{data.prospects.tauxConversionPercent !== null ? " %" : ""}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Score moyen</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{data.prospects.scoreMoyen}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Duree moyenne cycle</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{data.prospects.dureeMoyenneCycleJours ?? "—"}{data.prospects.dureeMoyenneCycleJours !== null ? " j" : ""}</p></CardContent>
              </Card>
            </div>
            <Card className="mb-6">
              <CardHeader><CardTitle>Repartition par statut</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-4 text-sm">
                {Object.entries(data.prospects.parStatut).map(([statut, count]) => (
                  <span key={statut}>{statut} : <strong>{count}</strong></span>
                ))}
                {Object.keys(data.prospects.parStatut).length === 0 && <span className="text-muted-foreground">Aucun prospect.</span>}
              </CardContent>
            </Card>

            <h2 className="mb-3 text-lg font-semibold">Devis</h2>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card>
                <CardHeader><CardTitle>Total actifs</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{data.devis.total}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Taux de transformation</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{data.devis.tauxTransformationPercent ?? "—"}{data.devis.tauxTransformationPercent !== null ? " %" : ""}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Montant moyen HT</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{data.devis.montantMoyenHt.toLocaleString("fr-FR")} €</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Delai moyen de reponse</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold">{data.devis.delaiMoyenReponseJours ?? "—"}{data.devis.delaiMoyenReponseJours !== null ? " j" : ""}</p></CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Repartition par statut</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-4 text-sm">
                {Object.entries(data.devis.parStatut).map(([statut, count]) => (
                  <span key={statut}>{statut} : <strong>{count}</strong></span>
                ))}
                {Object.keys(data.devis.parStatut).length === 0 && <span className="text-muted-foreground">Aucun devis.</span>}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
