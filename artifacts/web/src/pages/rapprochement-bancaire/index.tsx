import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RAPPROCHEMENT_STATUT_LABELS,
  annulerRapprochement,
  importReleveBancaire,
  listTransactionsBancaires,
  rapprocherTransaction,
  type TransactionBancaire,
} from "@/lib/transactionsBancaires";
import { listFactures } from "@/lib/factures";
import { listDepenses } from "@/lib/depenses";

export default function RapprochementBancairePage() {
  const queryClient = useQueryClient();
  const { data: transactions, isLoading, isError } = useQuery({ queryKey: ["transactions-bancaires"], queryFn: listTransactionsBancaires });
  const { data: factures } = useQuery({ queryKey: ["factures"], queryFn: listFactures });
  const { data: depenses } = useQuery({ queryKey: ["depenses"], queryFn: () => listDepenses() });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [manualPickerId, setManualPickerId] = useState<string | null>(null);

  const all = transactions ?? [];
  const nonRapprochees = all.filter((t) => t.rapprochementStatut === "NON_RAPPROCHE").length;
  const facturesEnAttente = (factures ?? []).filter((f) => f.statut === "ENVOYEE" || f.statut === "EN_RETARD");
  const depensesEnAttente = (depenses ?? []).filter((d) => d.statut === "A_VALIDER" || d.statut === "BON_A_PAYER");

  const sorted = useMemo(
    () => [...all].sort((a, b) => (a.dateOperation < b.dateOperation ? 1 : -1)),
    [all],
  );

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setImportError("Selectionnez un fichier CSV");
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportNotice(null);
    try {
      const result = await importReleveBancaire(file);
      await queryClient.invalidateQueries({ queryKey: ["transactions-bancaires"] });
      await queryClient.invalidateQueries({ queryKey: ["factures"] });
      await queryClient.invalidateQueries({ queryKey: ["depenses"] });
      setImportNotice(`${result.total} operation(s) importee(s), ${result.rapprochees} rapprochee(s) automatiquement.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  }

  async function handleIgnorer(tx: TransactionBancaire) {
    await rapprocherTransaction(tx.id, { ignore: true });
    await queryClient.invalidateQueries({ queryKey: ["transactions-bancaires"] });
  }

  async function handleAnnuler(tx: TransactionBancaire) {
    await annulerRapprochement(tx.id);
    await queryClient.invalidateQueries({ queryKey: ["transactions-bancaires"] });
  }

  async function handleRapprocherManuel(tx: TransactionBancaire, id: string) {
    if (Number(tx.montant) > 0) {
      await rapprocherTransaction(tx.id, { factureId: id });
    } else {
      await rapprocherTransaction(tx.id, { depenseId: id });
    }
    await queryClient.invalidateQueries({ queryKey: ["transactions-bancaires"] });
    await queryClient.invalidateQueries({ queryKey: ["factures"] });
    await queryClient.invalidateQueries({ queryKey: ["depenses"] });
    setManualPickerId(null);
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Rapprochement bancaire</h1>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Import manuel d'un releve bancaire (CSV, colonnes : date;libelle;montant). Aucun agregateur bancaire tiers
          n'est configure — chaque operation est rapprochee automatiquement quand son montant correspond a une seule
          facture ou depense en attente de paiement, sinon a rapprocher manuellement ci-dessous.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Operations importees</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>A rapprocher</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${nonRapprochees > 0 ? "text-orange-400" : ""}`}>{nonRapprochees}</p></CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Importer un releve</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="text-sm" />
            <div>
              <Button onClick={handleImport} disabled={importing}>{importing ? "Import..." : "Importer"}</Button>
            </div>
            {importError && <p className="text-sm text-red-400">{importError}</p>}
            {importNotice && <p className="text-sm text-emerald-400">{importNotice}</p>}
          </CardContent>
        </Card>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Libelle</th>
                <th className="px-4 py-2">Montant</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx) => {
                const montant = Number(tx.montant);
                const candidates = montant > 0 ? facturesEnAttente : depensesEnAttente;
                return (
                  <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{tx.dateOperation}</td>
                    <td className="px-4 py-2">{tx.libelle}</td>
                    <td className={`px-4 py-2 font-medium ${montant >= 0 ? "text-emerald-400" : "text-foreground"}`}>
                      {montant.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="px-4 py-2">{RAPPROCHEMENT_STATUT_LABELS[tx.rapprochementStatut]}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        {tx.rapprochementStatut === "NON_RAPPROCHE" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setManualPickerId(manualPickerId === tx.id ? null : tx.id)}>
                              Rapprocher
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleIgnorer(tx)}>Ignorer</Button>
                          </>
                        )}
                        {(tx.rapprochementStatut === "RAPPROCHE_AUTO" || tx.rapprochementStatut === "RAPPROCHE_MANUEL") && (
                          <Button size="sm" variant="outline" onClick={() => handleAnnuler(tx)}>Annuler</Button>
                        )}
                        {manualPickerId === tx.id && (
                          <select
                            className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                            defaultValue=""
                            onChange={(e) => e.target.value && handleRapprocherManuel(tx, e.target.value)}
                          >
                            <option value="" disabled>{montant > 0 ? "Choisir une facture..." : "Choisir une depense..."}</option>
                            {candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {"numero" in c ? c.numero : c.fournisseur} — {Number(c.montantHt).toLocaleString("fr-FR")} € HT
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && !isError && sorted.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune operation importee pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
