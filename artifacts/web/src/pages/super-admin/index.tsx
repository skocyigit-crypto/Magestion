import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clearToken, clearUser, getUser } from "@/lib/api";
import {
  PLAN_LABELS,
  STATUS_LABELS,
  getPlatformStats,
  listLicences,
  updateLicence,
  type LicencePlan,
  type LicenceStatus,
} from "@/lib/super-admin";

// Console cross-tenant du proprietaire de la plateforme (SUPER_ADMIN sans
// licence — voir lib/tenantScope.ts::isPlatformOwner). N'utilise JAMAIS le
// composant Layout tenant : aucune notion de licence courante ici, la nav
// tenant (Chantiers, Devis...) n'a pas de sens pour ce role.
export default function SuperAdminPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "SUPER_ADMIN" || user.licenceId !== null) {
      navigate("/login");
    }
  }, [navigate]);

  const { data: stats } = useQuery({ queryKey: ["super-admin-stats"], queryFn: getPlatformStats });
  const { data: licences, isLoading, isError } = useQuery({ queryKey: ["super-admin-licences"], queryFn: listLicences });
  const [error, setError] = useState<string | null>(null);

  function handleLogout() {
    clearToken();
    clearUser();
    navigate("/login");
  }

  async function handleStatusChange(id: string, status: LicenceStatus) {
    setError(null);
    try {
      await updateLicence(id, { status });
      await queryClient.invalidateQueries({ queryKey: ["super-admin-licences"] });
      await queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la mise a jour");
    }
  }

  async function handlePlanChange(id: string, plan: LicencePlan) {
    setError(null);
    try {
      await updateLicence(id, { plan });
      await queryClient.invalidateQueries({ queryKey: ["super-admin-licences"] });
      await queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la mise a jour");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-semibold text-primary">Magestion — Console plateforme</span>
        <Button variant="outline" size="sm" onClick={handleLogout}>Deconnexion</Button>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Licences (tenants)</h1>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Total licences</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{stats?.totalLicences ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Actives</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{stats?.actives ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Suspendues</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${(stats?.suspendues ?? 0) > 0 ? "text-red-400" : ""}`}>{stats?.suspendues ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>En essai</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{stats?.parPlan.TRIAL ?? 0}</p></CardContent>
          </Card>
        </div>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2">Entreprise</th>
                <th className="px-4 py-2">Utilisateurs</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Cree le</th>
              </tr>
            </thead>
            <tbody>
              {(licences ?? []).map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">{l.nom}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.nbUtilisateurs}</td>
                  <td className="px-4 py-2">
                    <select
                      className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                      value={l.plan}
                      onChange={(e) => handlePlanChange(l.id, e.target.value as LicencePlan)}
                    >
                      {Object.entries(PLAN_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className={`h-8 rounded-md border border-border bg-transparent px-2 text-xs ${l.status === "SUSPENDU" ? "text-red-400" : ""}`}
                      value={l.status}
                      onChange={(e) => handleStatusChange(l.id, e.target.value as LicenceStatus)}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
              {!isLoading && !isError && (licences ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune licence pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
