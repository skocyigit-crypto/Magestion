import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AVENANT_STATUT_LABELS,
  AVENANT_TYPE_LABELS,
  MARCHE_STATUT_LABELS,
  changeAvenantStatut,
  changeMarcheStatut,
  createAvenant,
  getMarchePublic,
  listAvenants,
  type AvenantInput,
  type AvenantType,
  type MarcheStatut,
} from "@/lib/marchesPublics";
import { LOT_STATUT_LABELS, changeLotMarcheStatut, createLotMarche, listLotsMarche, type LotMarcheInput } from "@/lib/lotsMarche";
import {
  DGD_STATUT_LABELS,
  GARANTIE_STATUT_LABELS,
  OS_STATUT_LABELS,
  ST_MARCHE_STATUT_LABELS,
  TYPE_GARANTIE_LABELS,
  TYPE_PV_LABELS,
  changeDgdStatut,
  changeMarcheSousTraitantStatut,
  createDgd,
  createGarantie,
  createMarcheSousTraitant,
  createOrdreService,
  createPvReception,
  leverGarantie,
  listDgd,
  listGaranties,
  listMarcheSousTraitants,
  listOrdresService,
  listPvReception,
  updateOrdreService,
  type DgdInput,
  type GarantieInput,
  type MarcheSousTraitantInput,
  type OrdreServiceInput,
  type PvReceptionInput,
  type TypeGarantie,
  type TypePv,
} from "@/lib/executionMarche";
import { listDoeMarche, createDoeMarche } from "@/lib/doeMarche";
import { listClients } from "@/lib/clients";
import { listSousTraitants } from "@/lib/sousTraitants";

type Tab = "apercu" | "lots" | "avenants" | "os" | "pv" | "dgd" | "garanties" | "sous-traitants" | "doe";

const TABS: { key: Tab; label: string }[] = [
  { key: "apercu", label: "Apercu" },
  { key: "lots", label: "Lots" },
  { key: "avenants", label: "Avenants" },
  { key: "os", label: "Ordres de service" },
  { key: "pv", label: "PV de reception" },
  { key: "dgd", label: "DGD" },
  { key: "garanties", label: "Garanties" },
  { key: "sous-traitants", label: "Sous-traitants" },
  { key: "doe", label: "DOE" },
];

const MARCHE_TRANSITIONS: Record<MarcheStatut, MarcheStatut[]> = {
  EN_COURS: ["TERMINE", "RESILIE", "SUSPENDU"],
  SUSPENDU: ["EN_COURS", "RESILIE"],
  TERMINE: [],
  RESILIE: [],
};

export default function MarcheDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("apercu");

  const { data: marche, isLoading, isError } = useQuery({ queryKey: ["marches-publics", id], queryFn: () => getMarchePublic(id) });
  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });

  function invalidateMarche() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marches-publics", id] }),
      queryClient.invalidateQueries({ queryKey: ["marches-publics"] }),
    ]);
  }

  async function handleStatutTransition(statut: MarcheStatut) {
    await changeMarcheStatut(id, statut);
    await invalidateMarche();
  }

  if (isLoading) return <Layout><p className="p-8 text-muted-foreground">Chargement...</p></Layout>;
  if (isError) return <Layout><p className="p-8 text-red-400">Erreur lors du chargement. Veuillez reessayer.</p></Layout>;
  if (!marche) return <Layout><p className="p-8 text-muted-foreground">Marche introuvable.</p></Layout>;

  const clientNom = (clients ?? []).find((c) => c.id === marche.clientId)?.nom ?? "—";

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{marche.numero}</h1>
            <p className="text-muted-foreground">{marche.intitule} — {clientNom}</p>
          </div>
          <div className="flex gap-2">
            {MARCHE_TRANSITIONS[marche.statut].map((s) => (
              <Button key={s} variant="outline" onClick={() => handleStatutTransition(s)}>{MARCHE_STATUT_LABELS[s]}</Button>
            ))}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Montant initial HT</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(marche.montantInitialHt).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant actuel HT</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{Number(marche.montantActuelHt).toLocaleString("fr-FR")} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>TVA</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{marche.tauxTva} %</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statut</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-semibold">{MARCHE_STATUT_LABELS[marche.statut]}</p></CardContent>
          </Card>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button key={t.key} variant={tab === t.key ? "default" : "outline"} size="sm" onClick={() => setTab(t.key)}>
              {t.label}
            </Button>
          ))}
        </div>

        {tab === "apercu" && (
          <Card>
            <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Procedure</p><p>{marche.procedureType}</p></div>
              <div><p className="text-muted-foreground">Delai d'execution</p><p>{marche.delaiExecutionMois ? `${marche.delaiExecutionMois} mois` : "—"}</p></div>
              <div><p className="text-muted-foreground">Date de notification</p><p>{marche.dateNotification ? new Date(marche.dateNotification).toLocaleDateString("fr-FR") : "—"}</p></div>
              <div><p className="text-muted-foreground">Date de reception</p><p>{marche.dateReception ? new Date(marche.dateReception).toLocaleDateString("fr-FR") : "—"}</p></div>
              <div><p className="text-muted-foreground">Retenue de garantie</p><p>{marche.retenueGarantiePourcent ? `${marche.retenueGarantiePourcent} %` : "—"}</p></div>
              <div><p className="text-muted-foreground">Delai de garantie</p><p>{marche.delaiGarantieMois ? `${marche.delaiGarantieMois} mois` : "—"}</p></div>
              <div><p className="text-muted-foreground">Clause de revision de prix</p><p>{marche.clauseRevisionPrix ? `Oui (${marche.indiceReference ?? "indice non renseigne"})` : "Non"}</p></div>
              <div><p className="text-muted-foreground">Penalites de retard</p><p>{marche.penalitesRetardJour ? `${marche.penalitesRetardJour} €/jour` : "—"}</p></div>
            </CardContent>
          </Card>
        )}

        {tab === "lots" && <LotsTab marcheId={id} clients={clients ?? []} />}
        {tab === "avenants" && <AvenantsTab marcheId={id} />}
        {tab === "os" && <OsTab marcheId={id} />}
        {tab === "pv" && <PvTab marcheId={id} />}
        {tab === "dgd" && <DgdTab marcheId={id} tauxTvaDefaut={Number(marche.tauxTva)} montantInitialDefaut={Number(marche.montantActuelHt)} />}
        {tab === "garanties" && <GarantiesTab marcheId={id} />}
        {tab === "sous-traitants" && <SousTraitantsTab marcheId={id} />}
        {tab === "doe" && <DoeTab marcheId={id} />}

        <p className="mt-6 text-xs text-muted-foreground">
          Un marche public n'est jamais supprime (tracabilite legale) — seul l'archivage est possible.
        </p>
      </div>
    </Layout>
  );
}

// --- Lots ---
function LotsTab({ marcheId, clients }: { marcheId: string; clients: { id: string; nom: string }[] }) {
  const queryClient = useQueryClient();
  const { data: lots, isLoading } = useQuery({ queryKey: ["lots-marche", marcheId], queryFn: () => listLotsMarche(marcheId) });
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Omit<LotMarcheInput, "marcheId">>({ numeroLot: "", intitule: "", montantEstimeHt: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createLotMarche({ marcheId, ...form });
      await queryClient.invalidateQueries({ queryKey: ["lots-marche", marcheId] });
      setIsOpen(false);
      setForm({ numeroLot: "", intitule: "", montantEstimeHt: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatut(lotId: string, statut: "ATTRIBUE" | "INFRUCTUEUX" | "TERMINE", attributaireClientId?: string) {
    await changeLotMarcheStatut(lotId, statut, attributaireClientId);
    await queryClient.invalidateQueries({ queryKey: ["lots-marche", marcheId] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Lots (allotissement)</CardTitle>
        <Button size="sm" onClick={() => setIsOpen(true)}>Ajouter un lot</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Lot</th>
                <th className="px-4 py-2">Intitule</th>
                <th className="px-4 py-2">Montant estime HT</th>
                <th className="px-4 py-2">Attributaire</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(lots ?? []).map((lot) => (
                <tr key={lot.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{lot.numeroLot}</td>
                  <td className="px-4 py-2">{lot.intitule}</td>
                  <td className="px-4 py-2">{Number(lot.montantEstimeHt).toLocaleString("fr-FR")} €</td>
                  <td className="px-4 py-2">{clients.find((c) => c.id === lot.attributaireClientId)?.nom ?? "—"}</td>
                  <td className="px-4 py-2">{LOT_STATUT_LABELS[lot.statut]}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {lot.statut === "A_ATTRIBUER" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleStatut(lot.id, "ATTRIBUE", clients[0]?.id)}>Attribuer</Button>
                          <Button variant="outline" size="sm" onClick={() => handleStatut(lot.id, "INFRUCTUEUX")}>Infructueux</Button>
                        </>
                      )}
                      {lot.statut === "ATTRIBUE" && (
                        <Button variant="outline" size="sm" onClick={() => handleStatut(lot.id, "TERMINE")}>Terminer</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (lots ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun lot pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Ajouter un lot</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="numeroLot">Numero de lot</Label>
              <Input id="numeroLot" required value={form.numeroLot} onChange={(e) => setForm({ ...form, numeroLot: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="corpsMetier">Corps de metier</Label>
              <Input id="corpsMetier" value={form.corpsMetier ?? ""} onChange={(e) => setForm({ ...form, corpsMetier: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intituleLot">Intitule</Label>
            <Input id="intituleLot" required value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="montantEstimeHt">Montant estime HT</Label>
            <Input id="montantEstimeHt" type="number" min={0} step="0.01" required value={form.montantEstimeHt} onChange={(e) => setForm({ ...form, montantEstimeHt: Number(e.target.value) })} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// --- Avenants ---
function AvenantsTab({ marcheId }: { marcheId: string }) {
  const queryClient = useQueryClient();
  const { data: avenants, isLoading } = useQuery({ queryKey: ["avenants-marche", marcheId], queryFn: () => listAvenants(marcheId) });
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<AvenantInput>({ objet: "", montantHt: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createAvenant(marcheId, form);
      await queryClient.invalidateQueries({ queryKey: ["avenants-marche", marcheId] });
      setIsOpen(false);
      setForm({ objet: "", montantHt: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatut(avenantId: string, statut: "SIGNE" | "TRANSMIS" | "IMPUTE") {
    const modeTransmission = statut === "TRANSMIS" ? "mail" : undefined;
    await changeAvenantStatut(marcheId, avenantId, statut, modeTransmission);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["avenants-marche", marcheId] }),
      queryClient.invalidateQueries({ queryKey: ["marches-publics", marcheId] }),
    ]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Avenants</CardTitle>
        <Button size="sm" onClick={() => setIsOpen(true)}>Ajouter un avenant</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2">Montant HT</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(avenants ?? []).map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{a.numero}</td>
                  <td className="px-4 py-2">{AVENANT_TYPE_LABELS[a.typeAvenant]}</td>
                  <td className="px-4 py-2">{a.objet}</td>
                  <td className="px-4 py-2">{Number(a.montantHt).toLocaleString("fr-FR")} €</td>
                  <td className="px-4 py-2">{AVENANT_STATUT_LABELS[a.statut]}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {a.statut === "BROUILLON" && <Button variant="outline" size="sm" onClick={() => handleStatut(a.id, "SIGNE")}>Signer</Button>}
                      {a.statut === "SIGNE" && <Button variant="outline" size="sm" onClick={() => handleStatut(a.id, "TRANSMIS")}>Transmettre</Button>}
                      {a.statut === "TRANSMIS" && <Button variant="outline" size="sm" onClick={() => handleStatut(a.id, "IMPUTE")}>Imputer</Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (avenants ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun avenant pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Ajouter un avenant</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="typeAvenant">Type</Label>
            <select
              id="typeAvenant"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.typeAvenant ?? "AUTRE"}
              onChange={(e) => setForm({ ...form, typeAvenant: e.target.value as AvenantType })}
            >
              {Object.entries(AVENANT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="objetAvenant">Objet</Label>
            <Input id="objetAvenant" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="montantHtAvenant">Montant HT</Label>
            <Input id="montantHtAvenant" type="number" step="0.01" required value={form.montantHt} onChange={(e) => setForm({ ...form, montantHt: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="justification">Justification</Label>
            <Input id="justification" value={form.justification ?? ""} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// --- Ordres de service ---
function OsTab({ marcheId }: { marcheId: string }) {
  const queryClient = useQueryClient();
  const { data: ordres, isLoading } = useQuery({ queryKey: ["os-marche", marcheId], queryFn: () => listOrdresService(marcheId) });
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Omit<OrdreServiceInput, "marcheId">>({ dateOs: "", objet: "", prescription: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createOrdreService({ marcheId, ...form });
      await queryClient.invalidateQueries({ queryKey: ["os-marche", marcheId] });
      setIsOpen(false);
      setForm({ dateOs: "", objet: "", prescription: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatut(osId: string, statut: "EXECUTE" | "REFUSE" | "RESERVES") {
    await updateOrdreService(osId, { statut });
    await queryClient.invalidateQueries({ queryKey: ["os-marche", marcheId] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ordres de service</CardTitle>
        <Button size="sm" onClick={() => setIsOpen(true)}>Ajouter un OS</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(ordres ?? []).map((os) => (
                <tr key={os.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{os.numero}</td>
                  <td className="px-4 py-2">{new Date(os.dateOs).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">{os.objet}</td>
                  <td className="px-4 py-2">{OS_STATUT_LABELS[os.statut]}</td>
                  <td className="px-4 py-2">
                    {os.statut === "NOTIFIE" && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleStatut(os.id, "EXECUTE")}>Execute</Button>
                        <Button variant="outline" size="sm" onClick={() => handleStatut(os.id, "REFUSE")}>Refuse</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && (ordres ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun ordre de service pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Ajouter un ordre de service</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateOs">Date</Label>
            <Input id="dateOs" type="date" required value={form.dateOs} onChange={(e) => setForm({ ...form, dateOs: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="objetOs">Objet</Label>
            <Input id="objetOs" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prescription">Prescription</Label>
            <Input id="prescription" required value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// --- PV de reception ---
function PvTab({ marcheId }: { marcheId: string }) {
  const queryClient = useQueryClient();
  const { data: pvs, isLoading } = useQuery({ queryKey: ["pv-reception", marcheId], queryFn: () => listPvReception(marcheId) });
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Omit<PvReceptionInput, "marcheId">>({ typePv: "RECEPTION", datePv: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createPvReception({ marcheId, ...form });
      await queryClient.invalidateQueries({ queryKey: ["pv-reception", marcheId] });
      setIsOpen(false);
      setForm({ typePv: "RECEPTION", datePv: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Proces-verbaux de reception</CardTitle>
        <Button size="sm" onClick={() => setIsOpen(true)}>Ajouter un PV</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Declenche garanties</th>
              </tr>
            </thead>
            <tbody>
              {(pvs ?? []).map((pv) => (
                <tr key={pv.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{pv.numero}</td>
                  <td className="px-4 py-2">{TYPE_PV_LABELS[pv.typePv]}</td>
                  <td className="px-4 py-2">{new Date(pv.datePv).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">{pv.declencheGaranties ? "Oui" : "Non"}</td>
                </tr>
              ))}
              {!isLoading && (pvs ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Aucun PV pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Ajouter un PV de reception</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="typePv">Type</Label>
            <select
              id="typePv"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.typePv}
              onChange={(e) => setForm({ ...form, typePv: e.target.value as TypePv })}
            >
              {Object.entries(TYPE_PV_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="datePv">Date</Label>
            <Input id="datePv" type="date" required value={form.datePv} onChange={(e) => setForm({ ...form, datePv: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="declencheGaranties"
              type="checkbox"
              checked={form.declencheGaranties ?? false}
              onChange={(e) => setForm({ ...form, declencheGaranties: e.target.checked })}
            />
            <Label htmlFor="declencheGaranties">Declenche le depart des garanties (GPA/biennale/decennale)</Label>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// --- DGD ---
function DgdTab({ marcheId, tauxTvaDefaut, montantInitialDefaut }: { marcheId: string; tauxTvaDefaut: number; montantInitialDefaut: number }) {
  const queryClient = useQueryClient();
  const { data: dgds, isLoading } = useQuery({ queryKey: ["dgd-marche", marcheId], queryFn: () => listDgd(marcheId) });
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Omit<DgdInput, "marcheId">>({ dateEtablissement: "", montantInitialHt: montantInitialDefaut, tauxTva: tauxTvaDefaut });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDgd({ marcheId, ...form });
      await queryClient.invalidateQueries({ queryKey: ["dgd-marche", marcheId] });
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const NEXT: Record<string, string[]> = {
    BROUILLON: ["ETABLI"],
    ETABLI: ["NOTIFIE"],
    NOTIFIE: ["ACCEPTE", "CONTESTE"],
    ACCEPTE: ["DEFINITIF"],
    CONTESTE: ["ETABLI"],
    DEFINITIF: [],
  };

  async function handleStatut(dgdId: string, statut: string) {
    await changeDgdStatut(dgdId, statut as never);
    await queryClient.invalidateQueries({ queryKey: ["dgd-marche", marcheId] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Decompte General Definitif</CardTitle>
        <Button size="sm" onClick={() => setIsOpen(true)}>Etablir un DGD</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Total HT</th>
                <th className="px-4 py-2">Solde a regler TTC</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(dgds ?? []).map((dgd) => (
                <tr key={dgd.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{dgd.numero}</td>
                  <td className="px-4 py-2">{new Date(dgd.dateEtablissement).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">{Number(dgd.totalDgdHt).toLocaleString("fr-FR")} €</td>
                  <td className="px-4 py-2">{Number(dgd.soldeARegler).toLocaleString("fr-FR")} €</td>
                  <td className="px-4 py-2">{DGD_STATUT_LABELS[dgd.statut]}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {NEXT[dgd.statut].map((s) => (
                        <Button key={s} variant="outline" size="sm" onClick={() => handleStatut(dgd.id, s)}>{DGD_STATUT_LABELS[s as keyof typeof DGD_STATUT_LABELS]}</Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (dgds ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucun DGD pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Etablir un DGD</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateEtablissement">Date d'etablissement</Label>
            <Input id="dateEtablissement" type="date" required value={form.dateEtablissement} onChange={(e) => setForm({ ...form, dateEtablissement: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="montantInitialHtDgd">Montant initial HT</Label>
              <Input id="montantInitialHtDgd" type="number" step="0.01" required value={form.montantInitialHt} onChange={(e) => setForm({ ...form, montantInitialHt: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="montantAvenantsHt">Montant avenants HT</Label>
              <Input id="montantAvenantsHt" type="number" step="0.01" value={form.montantAvenantsHt ?? 0} onChange={(e) => setForm({ ...form, montantAvenantsHt: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="penalitesHt">Penalites HT</Label>
              <Input id="penalitesHt" type="number" step="0.01" value={form.penalitesHt ?? 0} onChange={(e) => setForm({ ...form, penalitesHt: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="retenueGarantieHt">Retenue de garantie HT</Label>
              <Input id="retenueGarantieHt" type="number" step="0.01" value={form.retenueGarantieHt ?? 0} onChange={(e) => setForm({ ...form, retenueGarantieHt: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tauxTvaDgd">TVA</Label>
              <select
                id="tauxTvaDgd"
                className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                value={form.tauxTva}
                onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) })}
              >
                {[0, 5.5, 10, 20].map((taux) => (
                  <option key={taux} value={taux}>{taux} %</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acomptesPercus">Acomptes deja percus</Label>
              <Input id="acomptesPercus" type="number" step="0.01" value={form.acomptesPercus ?? 0} onChange={(e) => setForm({ ...form, acomptesPercus: Number(e.target.value) })} />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// --- Garanties ---
function GarantiesTab({ marcheId }: { marcheId: string }) {
  const queryClient = useQueryClient();
  const { data: garanties, isLoading } = useQuery({ queryKey: ["garanties-marche", marcheId], queryFn: () => listGaranties(marcheId) });
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Omit<GarantieInput, "marcheId">>({ typeGarantie: "DECENNALE" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createGarantie({ marcheId, ...form });
      await queryClient.invalidateQueries({ queryKey: ["garanties-marche", marcheId] });
      setIsOpen(false);
      setForm({ typeGarantie: "DECENNALE" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleLever(garantieId: string) {
    await leverGarantie(garantieId);
    await queryClient.invalidateQueries({ queryKey: ["garanties-marche", marcheId] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Garanties</CardTitle>
        <Button size="sm" onClick={() => setIsOpen(true)}>Ajouter une garantie</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Emetteur</th>
                <th className="px-4 py-2">Montant HT</th>
                <th className="px-4 py-2">Fin de validite</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(garanties ?? []).map((g) => (
                <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{TYPE_GARANTIE_LABELS[g.typeGarantie]}</td>
                  <td className="px-4 py-2">{g.emetteur || "—"}</td>
                  <td className="px-4 py-2">{g.montantHt ? `${Number(g.montantHt).toLocaleString("fr-FR")} €` : "—"}</td>
                  <td className="px-4 py-2">{g.dateFin ? new Date(g.dateFin).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-2">{GARANTIE_STATUT_LABELS[g.statut]}</td>
                  <td className="px-4 py-2">
                    {g.statut === "ACTIVE" && <Button variant="outline" size="sm" onClick={() => handleLever(g.id)}>Lever</Button>}
                  </td>
                </tr>
              ))}
              {!isLoading && (garanties ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucune garantie pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Ajouter une garantie</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="typeGarantie">Type</Label>
            <select
              id="typeGarantie"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.typeGarantie}
              onChange={(e) => setForm({ ...form, typeGarantie: e.target.value as TypeGarantie })}
            >
              {Object.entries(TYPE_GARANTIE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emetteur">Emetteur</Label>
              <Input id="emetteur" value={form.emetteur ?? ""} onChange={(e) => setForm({ ...form, emetteur: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="montantHtGarantie">Montant HT</Label>
              <Input id="montantHtGarantie" type="number" step="0.01" value={form.montantHt ?? ""} onChange={(e) => setForm({ ...form, montantHt: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateDebutGarantie">Date de debut</Label>
              <Input id="dateDebutGarantie" type="date" value={form.dateDebut ?? ""} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateFinGarantie">Date de fin</Label>
              <Input id="dateFinGarantie" type="date" value={form.dateFin ?? ""} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// --- Sous-traitants sur marche ---
function SousTraitantsTab({ marcheId }: { marcheId: string }) {
  const queryClient = useQueryClient();
  const { data: sousTraitantsMarche, isLoading } = useQuery({ queryKey: ["marche-sous-traitants", marcheId], queryFn: () => listMarcheSousTraitants(marcheId) });
  const { data: sousTraitants } = useQuery({ queryKey: ["sous-traitants"], queryFn: () => listSousTraitants() });
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Omit<MarcheSousTraitantInput, "marcheId">>({ sousTraitantId: "", natureTravaux: "", montantSousTraiteHt: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const raisonSociale = (id: string) => (sousTraitants ?? []).find((s) => s.id === id)?.raisonSociale ?? "—";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createMarcheSousTraitant({ marcheId, ...form });
      await queryClient.invalidateQueries({ queryKey: ["marche-sous-traitants", marcheId] });
      setIsOpen(false);
      setForm({ sousTraitantId: "", natureTravaux: "", montantSousTraiteHt: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const NEXT: Record<string, string[]> = {
    PROPOSE: ["ACCEPTE_MOA", "REFUSE"],
    ACCEPTE_MOA: ["ACTIF"],
    ACTIF: ["TERMINE"],
    REFUSE: [],
    TERMINE: [],
  };

  async function handleStatut(id: string, statut: string) {
    await changeMarcheSousTraitantStatut(id, statut as never);
    await queryClient.invalidateQueries({ queryKey: ["marche-sous-traitants", marcheId] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sous-traitance sur ce marche (DC4)</CardTitle>
        <Button size="sm" onClick={() => setIsOpen(true)}>Ajouter</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Sous-traitant</th>
                <th className="px-4 py-2">Nature des travaux</th>
                <th className="px-4 py-2">Montant sous-traite HT</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(sousTraitantsMarche ?? []).map((st) => (
                <tr key={st.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{raisonSociale(st.sousTraitantId)}</td>
                  <td className="px-4 py-2">{st.natureTravaux}</td>
                  <td className="px-4 py-2">{Number(st.montantSousTraiteHt).toLocaleString("fr-FR")} €</td>
                  <td className="px-4 py-2">{ST_MARCHE_STATUT_LABELS[st.statut]}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {NEXT[st.statut].map((s) => (
                        <Button key={s} variant="outline" size="sm" onClick={() => handleStatut(st.id, s)}>{ST_MARCHE_STATUT_LABELS[s as keyof typeof ST_MARCHE_STATUT_LABELS]}</Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (sousTraitantsMarche ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun sous-traitant affecte pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader><DialogTitle>Affecter un sous-traitant au marche</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sousTraitantId">Sous-traitant</Label>
            <select
              id="sousTraitantId"
              required
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.sousTraitantId}
              onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
            >
              <option value="">Selectionner...</option>
              {(sousTraitants ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.raisonSociale}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="natureTravaux">Nature des travaux</Label>
            <Input id="natureTravaux" required value={form.natureTravaux} onChange={(e) => setForm({ ...form, natureTravaux: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="montantSousTraiteHt">Montant sous-traite HT</Label>
            <Input id="montantSousTraiteHt" type="number" step="0.01" required value={form.montantSousTraiteHt} onChange={(e) => setForm({ ...form, montantSousTraiteHt: Number(e.target.value) })} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// --- DOE ---
function DoeTab({ marcheId }: { marcheId: string }) {
  const queryClient = useQueryClient();
  const { data: versions, isLoading } = useQuery({ queryKey: ["doe-marche", marcheId], queryFn: () => listDoeMarche(marcheId) });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      await createDoeMarche({ marcheId });
      await queryClient.invalidateQueries({ queryKey: ["doe-marche", marcheId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la finalisation");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Dossier des Ouvrages Executes (DOE)</CardTitle>
        <Button size="sm" onClick={handleCreate} disabled={creating}>{creating ? "Finalisation..." : "Finaliser une nouvelle version"}</Button>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Version</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Date de finalisation</th>
              </tr>
            </thead>
            <tbody>
              {(versions ?? []).map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">v{v.version}</td>
                  <td className="px-4 py-2">{v.statut === "FINALISE" ? "Finalise (courant)" : "Remplace"}</td>
                  <td className="px-4 py-2">{new Date(v.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
              {!isLoading && (versions ?? []).length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Aucune version finalisee pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
