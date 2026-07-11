import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FACTURE_STATUT_LABELS, listFactures } from "@/lib/factures";
import { montantTtc } from "@/lib/devis";

export default function FacturesPage() {
  const { data: factures, isLoading } = useQuery({ queryKey: ["factures"], queryFn: listFactures });
  const [search, setSearch] = useState("");
  const all = factures ?? [];

  const totalTtc = all.reduce((sum, f) => sum + montantTtc(f.montantHt, f.tauxTva), 0);
  const encaisse = all.filter((f) => f.statut === "PAYEE").reduce((sum, f) => sum + montantTtc(f.montantHt, f.tauxTva), 0);
  const enAttente = all.filter((f) => f.statut === "ENVOYEE" || f.statut === "EN_RETARD").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (f) =>
        f.numero.toLowerCase().includes(q) ||
        f.client.toLowerCase().includes(q) ||
        f.objet.toLowerCase().includes(q),
    );
  }, [all, search]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Factures clients</h1>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Total factures</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Montant total TTC</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{totalTtc.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Encaisse</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{encaisse.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En attente paiement</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{enAttente}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (numero, client, objet)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Numero</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2">Montant TTC</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link href={`/factures/${f.id}`} className="text-primary hover:underline">{f.numero}</Link>
                  </td>
                  <td className="px-4 py-2">{f.client}</td>
                  <td className="px-4 py-2">{f.objet}</td>
                  <td className="px-4 py-2">{montantTtc(f.montantHt, f.tauxTva).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                  <td className="px-4 py-2">{FACTURE_STATUT_LABELS[f.statut]}</td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune facture pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
