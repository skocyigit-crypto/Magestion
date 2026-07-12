import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  NIVEAU_COLORS,
  NIVEAU_LABELS,
  PALIER_COLORS,
  PALIER_LABELS,
  listRelancesAFaire,
  listRelancesFacturesAFaire,
  logRelance,
  logRelanceFacture,
} from "@/lib/relances";
import { montantTtc } from "@/lib/devis";

export default function RelancesPage() {
  const queryClient = useQueryClient();
  const { data: aFaire, isLoading, isError } = useQuery({ queryKey: ["relances", "a-faire"], queryFn: listRelancesAFaire });
  const { data: facturesAFaire, isLoading: facturesLoading, isError: facturesError } = useQuery({ queryKey: ["relances", "factures-a-faire"], queryFn: listRelancesFacturesAFaire });
  const [notices, setNotices] = useState<Record<string, string>>({});

  const all = aFaire ?? [];
  const j30 = all.filter((r) => r.palier === "J30").length;
  const allFactures = facturesAFaire ?? [];
  const miseEnDemeure = allFactures.filter((r) => r.niveau === "MISE_EN_DEMEURE").length;

  async function handleRelancer(devisId: string) {
    const result = await logRelance(devisId, "EMAIL");
    await queryClient.invalidateQueries({ queryKey: ["relances"] });
    const notice = result.emailSent
      ? "Email de relance envoye."
      : result.emailError
        ? `Relance enregistree, email non envoye : ${result.emailError}`
        : "Relance enregistree.";
    setNotices((prev) => ({ ...prev, [devisId]: notice }));
  }

  async function handleRelancerFacture(factureId: string) {
    const result = await logRelanceFacture(factureId, "EMAIL");
    await queryClient.invalidateQueries({ queryKey: ["relances"] });
    await queryClient.invalidateQueries({ queryKey: ["factures"] });
    const notice = result.emailSent
      ? "Email de relance envoye."
      : result.emailError
        ? `Relance enregistree, email non envoye : ${result.emailError}`
        : "Relance enregistree.";
    setNotices((prev) => ({ ...prev, [factureId]: notice }));
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Relances clients</h1>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Devis a relancer</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Urgent (J+30 et plus)</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${j30 > 0 ? "text-red-400" : ""}`}>{j30}</p></CardContent>
          </Card>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="flex flex-col gap-2">
          {all.map((r) => (
            <div key={r.devisId} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="font-medium">{r.numero} — {r.client}</p>
                <p className="text-sm text-muted-foreground">
                  {r.objet} — {Number(r.montantHt).toLocaleString("fr-FR")} € HT — envoye il y a {r.joursDepuisEnvoi} jours
                  {r.nbRelancesEffectuees > 0 && ` — ${r.nbRelancesEffectuees} relance(s) deja effectuee(s)`}
                </p>
                {notices[r.devisId] && <p className="mt-1 text-xs text-muted-foreground">{notices[r.devisId]}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${PALIER_COLORS[r.palier]}`}>{PALIER_LABELS[r.palier]}</span>
                <Button size="sm" onClick={() => handleRelancer(r.devisId)}>Envoyer relance par email</Button>
              </div>
            </div>
          ))}
          {!isLoading && !isError && all.length === 0 && <p className="text-muted-foreground">Aucun devis en attente de relance — tout est a jour.</p>}
        </div>

        <h2 className="mb-3 mt-8 text-lg font-semibold">Factures impayees</h2>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Factures a relancer</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{allFactures.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mise en demeure (J+30)</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${miseEnDemeure > 0 ? "text-red-400" : ""}`}>{miseEnDemeure}</p></CardContent>
          </Card>
        </div>

        {facturesError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {facturesLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="flex flex-col gap-2">
          {allFactures.map((r) => (
            <div key={r.factureId} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="font-medium">{r.numero} — {r.client}</p>
                <p className="text-sm text-muted-foreground">
                  {r.objet} — {montantTtc(r.montantHt, r.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} € TTC — {r.joursDeRetard} jours de retard
                  {r.nbRelancesEffectuees > 0 && ` — ${r.nbRelancesEffectuees} relance(s) deja effectuee(s)`}
                </p>
                {notices[r.factureId] && <p className="mt-1 text-xs text-muted-foreground">{notices[r.factureId]}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${NIVEAU_COLORS[r.niveau]}`}>{NIVEAU_LABELS[r.niveau]}</span>
                <Button size="sm" onClick={() => handleRelancerFacture(r.factureId)}>Envoyer relance par email</Button>
              </div>
            </div>
          ))}
          {!facturesLoading && !facturesError && allFactures.length === 0 && <p className="text-muted-foreground">Aucune facture en retard — tout est a jour.</p>}
        </div>
      </div>
    </Layout>
  );
}
