import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { annulerLettrage, downloadFec, lettrer, listBalance, listEcrituresNonLettrees, listJournal, listPlanComptable } from "@/lib/comptabilite";
import { calculerTva, creerDeclarationTva, listDeclarationsTva, validerDeclarationTva, type TvaCalcul } from "@/lib/declarationsTva";
import {
  STATUT_LABELS as CLOTURE_STATUT_LABELS,
  getClotureStats,
  listEtapesCloture,
  reinitialiserCloture,
  updateEtapeCloture,
  type EtapeClotureStatut,
} from "@/lib/clotureComptable";

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tab = "journal" | "balance" | "plan" | "lettrage" | "tva" | "cloture";

export default function ComptabilitePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("journal");
  const [exercice, setExercice] = useState<string>("");
  const exerciceNum = exercice ? Number(exercice) : undefined;

  const [compteLettrage, setCompteLettrage] = useState("411");
  const { data: nonLettrees, isLoading: nonLettreesLoading, isError: nonLettreesError } = useQuery({
    queryKey: ["comptabilite", "lettrage", compteLettrage],
    queryFn: () => listEcrituresNonLettrees(compteLettrage),
    enabled: tab === "lettrage",
  });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [lettrageError, setLettrageError] = useState<string | null>(null);
  const [lettrageNotice, setLettrageNotice] = useState<string | null>(null);

  function toggleSelection(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectionnees = (nonLettrees ?? []).filter((e) => selection.has(e.id));
  const selDebit = selectionnees.reduce((s, e) => s + Number(e.debit), 0);
  const selCredit = selectionnees.reduce((s, e) => s + Number(e.credit), 0);
  const selEquilibree = selection.size >= 2 && Math.abs(selDebit - selCredit) < 0.01;

  async function handleLettrer() {
    setLettrageError(null);
    setLettrageNotice(null);
    try {
      const result = await lettrer(Array.from(selection));
      setLettrageNotice(`Lettrage ${result.code} enregistre (${result.entryIds.length} ecritures).`);
      setSelection(new Set());
      await queryClient.invalidateQueries({ queryKey: ["comptabilite"] });
    } catch (err) {
      setLettrageError(err instanceof Error ? err.message : "Erreur lors du lettrage");
    }
  }

  async function handleAnnulerLettrage(code: string) {
    await annulerLettrage(code);
    await queryClient.invalidateQueries({ queryKey: ["comptabilite"] });
  }

  const { data: declarationsTva } = useQuery({ queryKey: ["declarations-tva"], queryFn: listDeclarationsTva });
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState("");
  const [apercu, setApercu] = useState<TvaCalcul | null>(null);
  const [tvaBusy, setTvaBusy] = useState(false);
  const [tvaError, setTvaError] = useState<string | null>(null);

  async function handleCalculerApercu() {
    if (!periodeDebut || !periodeFin) return;
    setTvaError(null);
    try {
      setApercu(await calculerTva(periodeDebut, periodeFin));
    } catch (err) {
      setTvaError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleCreerDeclaration() {
    if (!periodeDebut || !periodeFin) return;
    setTvaBusy(true);
    setTvaError(null);
    try {
      await creerDeclarationTva(periodeDebut, periodeFin);
      setApercu(null);
      setPeriodeDebut("");
      setPeriodeFin("");
      await queryClient.invalidateQueries({ queryKey: ["declarations-tva"] });
    } catch (err) {
      setTvaError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setTvaBusy(false);
    }
  }

  async function handleValiderDeclaration(id: string) {
    await validerDeclarationTva(id);
    await queryClient.invalidateQueries({ queryKey: ["declarations-tva"] });
  }

  const [exerciceCloture, setExerciceCloture] = useState<string>(String(new Date().getFullYear()));
  const { data: etapesCloture, isLoading: etapesClotureLoading, isError: etapesClotureError } = useQuery({
    queryKey: ["cloture-comptable", exerciceCloture],
    queryFn: () => listEtapesCloture(exerciceCloture),
    enabled: tab === "cloture",
  });
  const { data: clotureStats } = useQuery({
    queryKey: ["cloture-comptable", "stats", exerciceCloture],
    queryFn: () => getClotureStats(exerciceCloture),
    enabled: tab === "cloture",
  });

  async function handleEtapeStatutChange(id: string, statut: EtapeClotureStatut) {
    await updateEtapeCloture(id, { statut });
    await queryClient.invalidateQueries({ queryKey: ["cloture-comptable"] });
  }

  async function handleReinitialiserCloture() {
    if (!confirm(`Reinitialiser toute la checklist de cloture ${exerciceCloture} ? Tous les statuts repasseront a "A faire".`)) return;
    await reinitialiserCloture(exerciceCloture);
    await queryClient.invalidateQueries({ queryKey: ["cloture-comptable"] });
  }

  const { data: journal, isLoading: journalLoading, isError: journalError } = useQuery({ queryKey: ["comptabilite", "journal"], queryFn: listJournal });
  const { data: balance, isLoading: balanceLoading, isError: balanceError } = useQuery({
    queryKey: ["comptabilite", "balance", exerciceNum],
    queryFn: () => listBalance(exerciceNum),
  });
  const { data: planComptable, isLoading: planComptableLoading, isError: planComptableError } = useQuery({ queryKey: ["comptabilite", "plan-comptable"], queryFn: listPlanComptable });
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
          <Button variant={tab === "lettrage" ? "default" : "outline"} size="sm" onClick={() => setTab("lettrage")}>
            Lettrage
          </Button>
          <Button variant={tab === "tva" ? "default" : "outline"} size="sm" onClick={() => setTab("tva")}>
            Declarations TVA
          </Button>
          <Button variant={tab === "cloture" ? "default" : "outline"} size="sm" onClick={() => setTab("cloture")}>
            Cloture d'exercice
          </Button>
        </div>

        {tab === "journal" && (
          <>
            {journalError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
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
                    <th className="px-3 py-2">Lettrage</th>
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
                      <td className="px-3 py-2">
                        {l.ecritureLet ? (
                          <button type="button" onClick={() => handleAnnulerLettrage(l.ecritureLet!)} className="text-primary hover:underline" title="Annuler ce lettrage">
                            {l.ecritureLet}
                          </button>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                  {!journalLoading && (journal ?? []).length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Aucune ecriture pour le moment.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "balance" && (
          <>
            {balanceError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
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
            {planComptableError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
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

        {tab === "lettrage" && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Rapproche des ecritures d'un meme compte qui se soldent entre elles (ex: une facture client et son
              reglement sur le compte 411). Selectionnez au moins 2 ecritures dont la somme debit = somme credit.
            </p>
            <div className="mb-4 flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="compteLettrage" className="text-xs text-muted-foreground">Compte</label>
                <Input id="compteLettrage" className="w-32" value={compteLettrage} onChange={(e) => setCompteLettrage(e.target.value)} placeholder="411" />
              </div>
            </div>

            {nonLettreesError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees.</p>}
            {nonLettreesLoading && <p className="text-muted-foreground">Chargement...</p>}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2"></th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Piece</th>
                    <th className="px-3 py-2">Libelle</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(nonLettrees ?? []).map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selection.has(e.id)} onChange={() => toggleSelection(e.id)} />
                      </td>
                      <td className="px-3 py-2">{e.ecritureDate}</td>
                      <td className="px-3 py-2">{e.pieceRef}</td>
                      <td className="px-3 py-2">{e.ecritureLib}</td>
                      <td className="px-3 py-2 text-right">{Number(e.debit) > 0 ? fmt(Number(e.debit)) : ""}</td>
                      <td className="px-3 py-2 text-right">{Number(e.credit) > 0 ? fmt(Number(e.credit)) : ""}</td>
                    </tr>
                  ))}
                  {!nonLettreesLoading && !nonLettreesError && (nonLettrees ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucune ecriture non lettree sur ce compte.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {selection.size > 0 && (
              <div className="mt-4 flex items-center gap-3 rounded-md bg-muted/30 p-3">
                <p className="text-sm">
                  {selection.size} selectionnee(s) — debit {fmt(selDebit)} € / credit {fmt(selCredit)} €
                  {selEquilibree ? <span className="ml-2 text-emerald-400">Equilibre</span> : <span className="ml-2 text-orange-400">Ne se solde pas</span>}
                </p>
                <Button size="sm" onClick={handleLettrer} disabled={!selEquilibree}>Lettrer la selection</Button>
              </div>
            )}
            {lettrageError && <p className="mt-2 text-sm text-red-400">{lettrageError}</p>}
            {lettrageNotice && <p className="mt-2 text-sm text-emerald-400">{lettrageNotice}</p>}
          </>
        )}

        {tab === "tva" && (
          <>
            <Card className="mb-6">
              <CardHeader><CardTitle>Nouvelle declaration</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Debut de periode</label>
                    <Input type="date" className="w-40" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Fin de periode</label>
                    <Input type="date" className="w-40" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCalculerApercu}>Calculer un apercu</Button>
                </div>
                {apercu && (
                  <div className="grid grid-cols-3 gap-4 rounded-md bg-muted/30 p-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">TVA collectee</p>
                      <p className="text-lg font-semibold">{fmt(apercu.tvaCollectee)} €</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">TVA deductible</p>
                      <p className="text-lg font-semibold">{fmt(apercu.tvaDeductible)} €</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">TVA a payer</p>
                      <p className={`text-lg font-semibold ${apercu.tvaAPayer < 0 ? "text-emerald-400" : ""}`}>{fmt(apercu.tvaAPayer)} €</p>
                    </div>
                  </div>
                )}
                {apercu && <Button size="sm" onClick={handleCreerDeclaration} disabled={tvaBusy}>{tvaBusy ? "Enregistrement..." : "Enregistrer cette declaration"}</Button>}
                {tvaError && <p className="text-sm text-red-400">{tvaError}</p>}
              </CardContent>
            </Card>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2">Periode</th>
                    <th className="px-3 py-2 text-right">TVA collectee</th>
                    <th className="px-3 py-2 text-right">TVA deductible</th>
                    <th className="px-3 py-2 text-right">TVA a payer</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(declarationsTva ?? []).map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">{d.periodeDebut} → {d.periodeFin}</td>
                      <td className="px-3 py-2 text-right">{fmt(Number(d.tvaCollectee))} €</td>
                      <td className="px-3 py-2 text-right">{fmt(Number(d.tvaDeductible))} €</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(Number(d.tvaAPayer))} €</td>
                      <td className="px-3 py-2">{d.statut === "VALIDEE" ? "Validee" : "Brouillon"}</td>
                      <td className="px-3 py-2">
                        {d.statut === "BROUILLON" && <Button size="sm" onClick={() => handleValiderDeclaration(d.id)}>Valider</Button>}
                      </td>
                    </tr>
                  ))}
                  {(declarationsTva ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucune declaration pour le moment.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === "cloture" && (
          <>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="exerciceCloture" className="text-xs text-muted-foreground">Exercice</label>
                <Input id="exerciceCloture" className="w-28" value={exerciceCloture} onChange={(e) => setExerciceCloture(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" onClick={handleReinitialiserCloture}>Reinitialiser la checklist</Button>
            </div>

            {clotureStats && (
              <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader><CardTitle>Progression</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-semibold">{clotureStats.progression}%</p></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Etapes terminees</CardTitle></CardHeader>
                  <CardContent><p className="text-2xl font-semibold">{clotureStats.nbFait} / {clotureStats.total}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Prochaine etape</CardTitle></CardHeader>
                  <CardContent><p className="text-sm">{clotureStats.prochaineEtape ?? "—"}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Pret pour cloture</CardTitle></CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-semibold ${clotureStats.pretPourCloture ? "text-emerald-400" : "text-orange-400"}`}>
                      {clotureStats.pretPourCloture ? "Oui" : "Non"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {etapesClotureError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees.</p>}
            {etapesClotureLoading && <p className="text-muted-foreground">Chargement...</p>}

            <div className="flex flex-col gap-2">
              {(etapesCloture ?? []).map((e) => (
                <Card key={e.id}>
                  <CardContent className="flex items-center justify-between gap-3 pt-4">
                    <div>
                      <p className="text-sm font-medium">
                        {e.ordre}. {e.titre}
                        {e.obligatoire && <span className="ml-2 text-xs text-orange-400">Obligatoire</span>}
                      </p>
                      {e.description && <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>}
                    </div>
                    <select
                      className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                      value={e.statut}
                      onChange={(ev) => handleEtapeStatutChange(e.id, ev.target.value as EtapeClotureStatut)}
                    >
                      {Object.entries(CLOTURE_STATUT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
