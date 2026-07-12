import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchLogoBlobUrl, getParametres, updateParametres, uploadLogo, type ParametresInput } from "@/lib/parametres";
import { PLAN_LABELS, getBillingStatus, listBillingPlans, openBillingPortal, startCheckout, type PlanKey } from "@/lib/billing";

const EMPTY_FORM: ParametresInput = { nom: "" };

export default function ParametresPage() {
  const { data: parametres, refetch, isError } = useQuery({ queryKey: ["parametres"], queryFn: getParametres });
  const { data: billingStatus, refetch: refetchBillingStatus } = useQuery({ queryKey: ["billing-status"], queryFn: getBillingStatus });
  const { data: billingPlans } = useQuery({ queryKey: ["billing-plans"], queryFn: listBillingPlans });
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanKey | null>(null);

  const [form, setForm] = useState<ParametresInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!parametres) return;
    setForm({
      nom: parametres.nom,
      siret: parametres.siret ?? undefined,
      adresse: parametres.adresse ?? undefined,
      codePostal: parametres.codePostal ?? undefined,
      ville: parametres.ville ?? undefined,
      email: parametres.email ?? undefined,
      telephone: parametres.telephone ?? undefined,
      tvaIntracommunautaire: parametres.tvaIntracommunautaire ?? undefined,
    });

    if (parametres.logoChemin) {
      fetchLogoBlobUrl().then((url) => setLogoUrl(url));
    } else {
      setLogoUrl(null);
    }
  }, [parametres]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateParametres(form);
      await refetch();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange() {
    const file = logoInputRef.current?.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      await uploadLogo(file);
      await refetch();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Erreur lors du televersement");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleCheckout(planKey: PlanKey) {
    setCheckoutError(null);
    setCheckoutLoading(planKey);
    try {
      const result = await startCheckout(planKey);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      await refetchBillingStatus();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Erreur lors de la mise a niveau");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handlePortal() {
    setCheckoutError(null);
    try {
      const result = await openBillingPortal();
      if (result.url) {
        window.location.href = result.url;
      } else if (result.simulation) {
        setCheckoutError("Mode simulation : aucun compte Stripe reel n'est configure, il n'y a pas de portail de facturation a ouvrir.");
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Erreur lors de l'ouverture du portail");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-semibold">Parametres de l'entreprise</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Ces informations apparaissent sur les devis/factures PDF et comme expediteur des emails. Le SIRET est utilise pour l'export FEC.
        </p>

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}

        <Card className="mb-6">
          <CardHeader><CardTitle>Abonnement</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {billingStatus && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/30 p-3 text-sm">
                <div>
                  <p>
                    Plan actuel : <span className="font-semibold">{PLAN_LABELS[billingStatus.plan]}</span>
                    {billingStatus.plan === "TRIAL" && billingStatus.joursRestantsEssai !== null && (
                      <span className={billingStatus.essaiExpire ? "ml-2 text-red-400" : "ml-2 text-muted-foreground"}>
                        {billingStatus.essaiExpire ? "— essai expire" : `— ${billingStatus.joursRestantsEssai} jour(s) restant(s)`}
                      </span>
                    )}
                  </p>
                  {billingStatus.simulation && (
                    <p className="mt-1 text-xs text-orange-400">Mode simulation : aucun compte Stripe reel configure, les mises a niveau sont immediates et gratuites (dev uniquement).</p>
                  )}
                </div>
                {billingStatus.abonneStripe && (
                  <Button size="sm" variant="outline" onClick={handlePortal}>Gerer l'abonnement</Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(billingPlans ?? []).map((plan) => (
                <div key={plan.key} className={`flex flex-col gap-2 rounded-md border p-4 text-sm ${billingStatus?.plan === plan.key ? "border-primary" : "border-border"}`}>
                  <p className="font-semibold">{plan.nom}</p>
                  <p className="text-lg font-semibold">{plan.prixMensuelEur} € <span className="text-xs font-normal text-muted-foreground">/ mois</span></p>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {plan.features.map((f) => <li key={f}>• {f}</li>)}
                  </ul>
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={!plan.disponible || billingStatus?.plan === plan.key || checkoutLoading === plan.key}
                    onClick={() => handleCheckout(plan.key)}
                  >
                    {checkoutLoading === plan.key ? "Redirection..." : billingStatus?.plan === plan.key ? "Plan actuel" : "Choisir ce plan"}
                  </Button>
                </div>
              ))}
            </div>
            {checkoutError && <p className="text-sm text-red-400">{checkoutError}</p>}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo entreprise" className="h-16 max-w-40 rounded-md border border-border bg-white object-contain p-1" />
              ) : (
                <div className="flex h-16 w-40 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  Aucun logo
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="text-sm" />
                <p className="text-xs text-muted-foreground">PNG, JPEG ou WEBP, 2 Mo max. Apparait sur les PDF devis/factures.</p>
                {logoUploading && <p className="text-xs text-muted-foreground">Televersement...</p>}
                {logoError && <p className="text-xs text-red-400">{logoError}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Coordonnees legales</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nom">Raison sociale</Label>
                  <Input id="nom" required value={form.nom ?? ""} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input id="siret" value={form.siret ?? ""} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adresse">Adresse</Label>
                <Input id="adresse" value={form.adresse ?? ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="codePostal">Code postal</Label>
                  <Input id="codePostal" value={form.codePostal ?? ""} onChange={(e) => setForm({ ...form, codePostal: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ville">Ville</Label>
                  <Input id="ville" value={form.ville ?? ""} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="telephone">Telephone</Label>
                  <Input id="telephone" value={form.telephone ?? ""} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tvaIntracommunautaire">TVA intracommunautaire (optionnel)</Label>
                <Input
                  id="tvaIntracommunautaire"
                  value={form.tvaIntracommunautaire ?? ""}
                  onChange={(e) => setForm({ ...form, tvaIntracommunautaire: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              {success && <p className="text-sm text-emerald-400">Enregistre.</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
