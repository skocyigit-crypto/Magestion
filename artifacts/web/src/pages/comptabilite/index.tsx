import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadFec, listBalance, listJournal, listPlanComptable } from "@/lib/comptabilite";

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tab = "journal" | "balance" | "plan";

export default function ComptabilitePage() {
  const [tab, setTab] = useState<Tab>("journal");
  const [exercice, setExercice] = useState<string>("");
  const exerciceNum = exercice ? Number(exercice) : undefined;

  const { data: journal, isLoading: journalLoading } = useQuery({ queryKey: ["comptabilite", "journal"], queryFn: listJournal });
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["comptabilite", "balance", exerciceNum],
    queryFn: () => listBalance(exerciceNum),
  });
  const { data: planComptable, isLoading: planComptableLoading } = useQuery({ queryKey: ["comptabilite", "plan-comptable"], queryFn: listPlanComptable });
  const [fecError, setFecError] = useState<string | null>(null);

  const totalDebit = useMemo(() => (journal ?? []).reduce((s, l) => s + Number(l.debit), 0), [journal]);
  const totalCredit = useMemo(() => (journal ?? []).reduce((s, l) => s + Number(l.credit), 0), [journal]);
  const equilibre = Math.abs(totalDebit - totalCredit) < 0.01;
  const nbEcritures = new Set((journal ?? []).map((l) => l.ecritureNum)).size;

  async function handleDownloadFec() {
    setFecError(null);
    try {
      await downloadFec(exerciceNum);
    } catch (err) {
      setFecError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Comptabilite</h1>
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="exercice" className="text-xs text-muted-foreground">Exercice (annee)</label>
              <Input
                id="exercice"
                type="number"
                placeholder="Tous"
                className="w-28"
                value={exercice}
                onChange={(e) => setExercice(e.target.value)}
              />
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button onClick={handleDownloadFec}>Exporter FEC</Button>
              {fecError && <p className="text-xs text-red-400">{fecError}</p>}
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Ecritures</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{nbEcritures}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total debit</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{fmt(totalDebit)} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total credit</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{fmt(totalCredit)} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Equilibre</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${equilibre ? "text-emerald-400" : "text-red-400"}`}>
                {equilibre ? "OK" : "DESEQUILIBRE"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-4 flex gap-2">
          <Button variant={tab === "journal" ? "default" : "outline"} size="sm" onClick={() => setTab("journal")}>
            Grand livre
          </Button>
          <Button variant={tab === "balance" ? "default" : "outline"} size="sm" onClick={() => setTab("balance")}>
            Balance de verification
          </Button>
          <Button variant={tab === "plan" ? "default" : "outline"} size="sm" onClick={() => setTab("plan")}>
            Plan comptable
          </Button>
        </div>

        {tab === "journal" && (
          <>
            {journalLoading && <p className="text-muted-foreground">Chargement...</p>}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2">N°</th>
                    <th className="px-3 py-2">Journal</th>
                    <th className="px-3 py-2">Compte</th>
                    <th className="px-3 py-2">Piece</th>
                    <th className="px-3 py-2">Libelle</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(journal ?? []).map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">{l.ecritureNum}</td>
                      <td className="px-3 py-2">{l.journalCode}</td>
                      <td className="px-3 py-2">{l.compteNum} — {l.compteLib}</td>
                      <td className="px-3 py-2">{l.pieceRef}</td>
                      <td className="px-3 py-2">{l.ecritureLib}</td>
                      <td className="px-3 py-2 text-right">{Number(l.debit) > 0 ? fmt(Number(l.debit)) : ""}</td>
                      <td className="px-3 py-2 text-right">{Number(l.credit) > 0 ? fmt(Number(l.credit)) : ""}</td>
                    </tr>
                  ))}
                  {!journalLoading && (journal ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Aucune ecriture pour le moment.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "balance" && (
          <>
            {balanceLoading && <p className="text-muted-foreground">Chargement...</p>}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2">Compte</th>
                    <th className="px-3 py-2 text-right">Total debit</th>
                    <th className="px-3 py-2 text-right">Total credit</th>
                    <th className="px-3 py-2 text-right">Solde</th>
                    <th className="px-3 py-2">Sens</th>
                  </tr>
                </thead>
                <tbody>
                  {(balance ?? []).map((b) => (
                    <tr key={b.compteNum} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">{b.compteNum} — {b.compteLib}</td>
                      <td className="px-3 py-2 text-right">{fmt(b.totalDebit)} €</td>
                      <td className="px-3 py-2 text-right">{fmt(b.totalCredit)} €</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(b.solde)} €</td>
                      <td className="px-3 py-2">{b.sens === "DEBITEUR" ? "Debiteur" : "Crediteur"}</td>
                    </tr>
                  ))}
                  {!balanceLoading && (balance ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune donnee pour le moment.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "plan" && (
          <>
            {planComptableLoading && <p className="text-muted-foreground">Chargement...</p>}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2">Compte</th>
                    <th className="px-3 py-2">Libelle</th>
                  </tr>
                </thead>
                <tbody>
                  {(planComptable ?? []).map((c) => (
                    <tr key={c.compteNum} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">{c.compteNum}</td>
                      <td className="px-3 py-2">{c.libelle}</td>
                    </tr>
                  ))}
                  {!planComptableLoading && (planComptable ?? []).length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">Aucun compte pour le moment.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
