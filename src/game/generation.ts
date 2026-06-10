/** Génération procédurale des gladiateurs, notes globales, valeurs, salaires. */

import { RNG } from '../core/rng';
import type { ClassId, Gladiator, Personnalite, Tier, TraitId, Traits } from '../core/types';
import { BALANCE, tierDe } from '../data/balance';
import { CLASSES, EPITHETES, PRENOMS } from '../data/noms';

/** Pondération des traits par classe : [principal ×3, secondaires ×2, le reste ×1]. */
const ARCHETYPES: Record<ClassId, { fort: TraitId[]; faible: TraitId[] }> = {
  colosse: { fort: ['force'], faible: ['vitesse', 'magie'] },
  bretteur: { fort: ['force', 'intelligence'], faible: ['magie'] },
  roublard: { fort: ['fourberie', 'esquive'], faible: ['force', 'magie'] },
  lancier: { fort: ['vitesse', 'intelligence'], faible: ['magie'] },
  mage: { fort: ['magie', 'intelligence'], faible: ['force'] },
  berserker: { fort: ['force', 'vitesse'], faible: ['intelligence', 'magie'] },
};

export const TRAIT_IDS: TraitId[] = ['force', 'vitesse', 'intelligence', 'fourberie', 'esquive', 'magie'];

/**
 * Note globale = moyenne pondérée des traits selon la classe (les traits forts
 * de l'archétype comptent double, la magie ne compte presque pas pour les
 * non-mages — un colosse n'est pas pénalisé d'être nul en magie).
 */
export function noteGlobale(traits: Traits, classe: ClassId): number {
  const arch = ARCHETYPES[classe];
  let somme = 0;
  let poids = 0;
  for (const t of TRAIT_IDS) {
    let p = 1;
    if (arch.fort.includes(t)) p = 2.2;
    else if (t === 'magie' && classe !== 'mage') p = 0.15;
    else if (arch.faible.includes(t)) p = 0.6;
    somme += traits[t] * p;
    poids += p;
  }
  return Math.round(somme / poids);
}

/** Salaire hebdomadaire attendu pour une note globale donnée. */
export function salaireAttendu(ovr: number): number {
  return Math.round(BALANCE.SAL_BASE * Math.exp((ovr - 40) / BALANCE.SAL_ECHELLE));
}

/** Salaire attendu par CE gladiateur (personnalité incluse). */
export function salaireExige(g: Gladiator): number {
  const ovr = noteGlobale(g.traits, g.classe);
  return Math.max(5, Math.round(salaireAttendu(ovr) * BALANCE.exigenceSalaire[g.personnalite]));
}

/** Facteur de valeur lié à l'âge : pic 23-27, décote forte après 31. */
export function facteurAge(age: number): number {
  if (age <= 20) return 0.9;
  if (age <= 27) return 1.1;
  if (age <= 29) return 0.95;
  if (age <= 31) return 0.75;
  if (age <= 33) return 0.5;
  return 0.3;
}

/** Valeur de transfert estimée en PO. */
export function valeurTransfert(g: Gladiator): number {
  const ovr = noteGlobale(g.traits, g.classe);
  const potRestant = Math.max(0, g.potentiel - ovr);
  const fPot = 1 + Math.min(0.5, potRestant * 0.04);
  const brut = salaireAttendu(ovr) * BALANCE.VAL_MULT * facteurAge(g.age) * fPot;
  return Math.max(50, Math.round(brut / 10) * 10);
}

const PERSONNALITES: Personnalite[] = ['fidele', 'cupide', 'fier', 'jovial', 'anxieux'];

let compteurNoms = 0;

export function genNom(rng: RNG): string {
  compteurNoms++;
  const prenom = rng.pick(PRENOMS);
  const epithete = rng.pick(EPITHETES);
  return `${prenom} ${epithete}`;
}

/**
 * Génère un gladiateur dont la note globale vise `ovrCible` (±2).
 * Les mages sont rares : tirés seulement si demandé ou ~12 % du temps.
 */
export function genGladiateur(
  rng: RNG,
  id: number,
  ovrCible: number,
  equipeId: number,
  classeForcee?: ClassId,
): Gladiator {
  let classe: ClassId;
  if (classeForcee) classe = classeForcee;
  else if (rng.chance(0.12)) classe = 'mage';
  else classe = rng.pick(CLASSES.filter((c) => c !== 'mage'));

  const arch = ARCHETYPES[classe];
  const traits: Traits = { force: 0, vitesse: 0, intelligence: 0, fourberie: 0, esquive: 0, magie: 0 };

  // Tirage initial : traits forts au-dessus de la cible, faibles en dessous.
  for (const t of TRAIT_IDS) {
    let centre = ovrCible;
    if (arch.fort.includes(t)) centre = ovrCible + 9;
    else if (arch.faible.includes(t)) centre = ovrCible - 12;
    if (t === 'magie') centre = classe === 'mage' ? ovrCible + 11 : Math.min(centre, 25);
    traits[t] = Math.round(Math.min(99, Math.max(5, centre + rng.gauss() * 5)));
  }

  // Calage fin : on ajuste proportionnellement pour atteindre la cible ±2.
  for (let i = 0; i < 12; i++) {
    const ovr = noteGlobale(traits, classe);
    const delta = ovrCible - ovr;
    if (Math.abs(delta) <= 2) break;
    for (const t of TRAIT_IDS) {
      if (classe !== 'mage' && t === 'magie') continue;
      traits[t] = Math.round(Math.min(99, Math.max(5, traits[t] + delta * 0.6)));
    }
  }

  const personnalite = rng.pick(PERSONNALITES);
  const age = Math.max(BALANCE.AGE_MIN, Math.min(34, Math.round(24 + rng.gauss() * 4)));
  const ovr = noteGlobale(traits, classe);
  // Les jeunes ont plus de marge de progression.
  const marge = age <= 21 ? rng.int(8, 16) : age <= 25 ? rng.int(5, 11) : age <= 29 ? rng.int(2, 6) : rng.int(0, 2);
  const potentiel = Math.min(99, ovr + marge);

  return {
    id,
    nom: genNom(rng),
    classe,
    variante: rng.int(0, 2),
    teinte: rng.int(-30, 30),
    traits,
    potentiel,
    age,
    moral: rng.int(55, 75),
    forme: rng.int(75, 95),
    fatigue: rng.int(0, 15),
    blessure: null,
    personnalite,
    salaire: Math.max(5, Math.round(salaireAttendu(ovr) * BALANCE.exigenceSalaire[personnalite])),
    equipeId,
    stats: { combats: 0, victoires: 0, elims: 0, degats: 0 },
  };
}

/** Cible de note globale typique pour une division (0=D1, 1=D2, 2=D3). */
export function ovrCibleDivision(rng: RNG, division: number): number {
  const centres = [74, 62, 51];
  const c = centres[Math.max(0, Math.min(2, division))] ?? 51;
  return Math.round(Math.min(96, Math.max(40, c + rng.gauss() * 5)));
}

/** Cible pour les équipes internationales (élite). */
export function ovrCibleInternational(rng: RNG): number {
  return Math.round(Math.min(99, Math.max(78, 86 + rng.gauss() * 4)));
}

export function palierDeGladiateur(g: Gladiator): Tier {
  return tierDe(noteGlobale(g.traits, g.classe));
}
