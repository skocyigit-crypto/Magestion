// Amortissement lineaire uniquement (v1) — le mode degressif (coefficients
// fiscaux, bascule automatique) est plus complexe et rarement utilise pour du
// petit materiel BTP ; peut etre ajoute plus tard si le besoin est confirme.

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface AmortissementParams {
  valeurAcquisition: number;
  dureeAmortissement: number;
  dateDebut: Date;
}

export interface LigneAmortissement {
  annee: number;
  dotation: number;
  cumul: number;
  vnc: number;
  prorata: number;
}

// Prorata temporis en jours (base 360, mois de 30 jours) du jour de mise en
// service au 31/12 de la meme annee.
function prorataPremiereAnnee(dateDebut: Date): number {
  const mois = dateDebut.getMonth();
  const jour = Math.min(dateDebut.getDate(), 30);
  const joursEcoules = mois * 30 + (jour - 1);
  const joursRestants = 360 - joursEcoules;
  return Math.max(0, Math.min(1, joursRestants / 360));
}

// Echeancier complet : la 1re annee est au prorata (mise en service en
// cours d'annee), le reliquat est repris sur une annuite supplementaire
// finale pour que le cumul egale exactement la valeur d'acquisition.
export function computeAmortissementPlan(params: AmortissementParams): LigneAmortissement[] {
  const va = round2(Math.max(0, params.valeurAcquisition));
  const duree = Math.max(1, Math.floor(params.dureeAmortissement));
  if (va <= 0) return [];

  const anneeDebut = params.dateDebut.getFullYear();
  const tauxAnnuel = 1 / duree;
  const prorata1 = prorataPremiereAnnee(params.dateDebut);
  const nbAnnees = prorata1 < 1 ? duree + 1 : duree;

  const lignes: LigneAmortissement[] = [];
  let cumul = 0;
  for (let i = 0; i < nbAnnees; i++) {
    const prorata = i === 0 ? prorata1 : 1;
    const dotation = i === nbAnnees - 1 ? round2(va - cumul) : round2(va * tauxAnnuel * prorata);
    cumul = round2(Math.min(cumul + Math.max(0, dotation), va));
    lignes.push({ annee: anneeDebut + i, dotation: Math.max(0, dotation), cumul, vnc: round2(va - cumul), prorata });
    if (cumul >= va) break;
  }
  return lignes;
}

export interface AmortissementSnapshot {
  amortissementCumule: number;
  valeurNetteComptable: number;
  dotationAnnuelle: number;
}

// Etat d'amortissement a une date donnee (par defaut aujourd'hui).
export function amortissementAsOf(params: AmortissementParams, asOf: Date = new Date()): AmortissementSnapshot {
  const va = round2(Math.max(0, params.valeurAcquisition));
  const plan = computeAmortissementPlan(params);
  if (plan.length === 0) {
    return { amortissementCumule: 0, valeurNetteComptable: va, dotationAnnuelle: 0 };
  }

  const anneeCible = asOf.getFullYear();
  const lignePleine = plan.find((l) => l.prorata >= 1) ?? plan[0];

  let cumul = 0;
  if (anneeCible >= plan[0].annee) {
    for (const ligne of plan) {
      if (ligne.annee <= anneeCible) cumul = ligne.cumul;
    }
  }

  return {
    amortissementCumule: round2(cumul),
    valeurNetteComptable: round2(va - cumul),
    dotationAnnuelle: round2(lignePleine.dotation),
  };
}
