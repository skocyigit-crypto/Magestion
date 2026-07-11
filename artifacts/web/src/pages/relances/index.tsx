import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PALIER_COLORS, PALIER_LABELS, listRelancesAFaire, logRelance } from "@/lib/relances";

export default function RelancesPage() {
  const queryClient = useQueryClient();
  const { data: aFaire } = useQuery({ queryKey: ["relances", "a-faire"], queryFn: listRelancesAFaire });
  const [notices, setNotices] = useState<Record<string, string>>({});

  const all = aFaire ?? [];
  const j30 = all.filter((r) => r.palier === "J30").length;

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
          {all.length === 0 && <p className="text-muted-foreground">Aucun devis en attente de relance — tout est a jour.</p>}
        </div>
      </div>
    </Layout>
  );
}
