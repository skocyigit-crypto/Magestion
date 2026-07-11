// Formule standard hakedis/situation de travaux BTP francais (verifiee dans
// les tests d'integration du projet de reference) :
//   cumulHT           = marche × avancement%
//   montantPeriodeHT   = cumulHT − cumulHT(situation precedente)
//   montantPeriodeTTC  = montantPeriodeHT × (1 + tauxTVA/100)
//   retenueGarantie    = montantPeriodeTTC × tauxRG/100
//   netAPayer          = montantPeriodeTTC − retenueGarantie
export function computeSituationMontants(input: {
  marcheHt: number;
  avancementPercent: number;
  tauxTva: number;
  tauxRetenueGarantie: number;
  cumulPrecedentHt: number;
}) {
  const montantCumulHt = input.marcheHt * (input.avancementPercent / 100);
  const montantPeriodeHt = montantCumulHt - input.cumulPrecedentHt;
  const montantPeriodeTva = montantPeriodeHt * (input.tauxTva / 100);
  const montantPeriodeTtc = montantPeriodeHt + montantPeriodeTva;
  const montantRetenueGarantie = montantPeriodeTtc * (input.tauxRetenueGarantie / 100);
  const montantNetAPayer = montantPeriodeTtc - montantRetenueGarantie;

  return {
    montantCumulHt,
    montantPeriodeHt,
    montantPeriodeTva,
    montantPeriodeTtc,
    montantRetenueGarantie,
    montantNetAPayer,
  };
}
