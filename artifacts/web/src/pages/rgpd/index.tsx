import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listEmployees } from "@/lib/employees";
import { listProspects, type Prospect } from "@/lib/prospects";
import { RGPD_ACTION_LABELS, anonymiser, exporterDonnees, listJournalRgpd } from "@/lib/rgpd";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function RgpdPage() {
  const queryClient = useQueryClient();
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const { data: prospects } = useQuery({ queryKey: ["prospects"], queryFn: () => listProspects() });
  const { data: journal, isLoading, isError } = useQuery({ queryKey: ["rgpd-journal"], queryFn: listJournalRgpd });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleExport(type: "EMPLOYEE" | "PROSPECT", id: string, label: string) {
    setBusyId(id);
    try {
      const data = await exporterDonnees(type, id);
      downloadJson(data, `rgpd-export-${label.replace(/\s+/g, "-")}.json`);
      await queryClient.invalidateQueries({ queryKey: ["rgpd-journal"] });
    } finally {
      setBusyId(null);
    }
  }

  async function handleAnonymiser(type: "EMPLOYEE" | "PROSPECT", id: string, label: string) {
    if (!confirm(`Anonymiser definitivement "${label}" ? Cette action est IRREVERSIBLE : nom, contact et coordonnees seront effaces sans retour possible.`)) return;
    setBusyId(id);
    try {
      await anonymiser(type, id);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["prospects"] });
      await queryClient.invalidateQueries({ queryKey: ["rgpd-journal"] });
    } finally {
      setBusyId(null);
    }
  }

  const employeesActifs = (employees ?? []).filter((e) => !e.anonymise);
  const prospectsActifs = (prospects ?? []).filter((p) => !p.anonymise);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-semibold">RGPD — donnees personnelles</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Droit d'acces (export complet des donnees detenues) et droit a l'effacement (anonymisation irreversible —
          concilie avec la regle de non-suppression : les enregistrements lies (pointages, historique) restent
          intacts mais ne sont plus identifiables). Reserve au super-administrateur.
        </p>

        <Card className="mb-6">
          <CardHeader><CardTitle>Employes</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {employeesActifs.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2">
                <span>{e.prenom} {e.nom}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => handleExport("EMPLOYEE", e.id, `${e.prenom}-${e.nom}`)}>Exporter</Button>
                  <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => handleAnonymiser("EMPLOYEE", e.id, `${e.prenom} ${e.nom}`)}>Anonymiser</Button>
                </div>
              </div>
            ))}
            {employeesActifs.length === 0 && <p className="py-2 text-sm text-muted-foreground">Aucun employe.</p>}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>Prospects</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {prospectsActifs.map((p: Prospect) => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <span>{p.nom}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => handleExport("PROSPECT", p.id, p.nom)}>Exporter</Button>
                  <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => handleAnonymiser("PROSPECT", p.id, p.nom)}>Anonymiser</Button>
                </div>
              </div>
            ))}
            {prospectsActifs.length === 0 && <p className="py-2 text-sm text-muted-foreground">Aucun prospect.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Journal RGPD</CardTitle></CardHeader>
          <CardContent>
            {isError && <p className="text-sm text-red-400">Erreur lors du chargement du journal.</p>}
            {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
            <div className="flex flex-col gap-1 text-sm">
              {(journal ?? []).map((entry) => (
                <div key={entry.id} className="flex justify-between border-b border-border py-1 last:border-0">
                  <span>{RGPD_ACTION_LABELS[entry.action]} — {entry.entityType} {entry.entityId.slice(0, 8)}</span>
                  <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString("fr-FR")}</span>
                </div>
              ))}
              {!isLoading && (journal ?? []).length === 0 && <p className="text-muted-foreground">Aucun evenement pour le moment.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
