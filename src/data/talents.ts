/** Talents cachés : définitions, descriptions et attribution par palier. */

import { RNG } from '../core/rng';
import type { ClassId, TalentId, Tier } from '../core/types';

export interface DefTalent {
  id: TalentId;
  nom: string;
  description: string;
  /** classes chez qui ce talent est plus fréquent (poids ×3) */
  affinites: ClassId[];
}

export const TALENTS: Record<TalentId, DefTalent> = {
  fumigene: {
    id: 'fumigene',
    nom: 'Bombe fumigène',
    description: 'Après une esquive, disparaît dans la fumée : invincible pendant 0,9 s.',
    affinites: ['roublard'],
  },
  dash: {
    id: 'dash',
    nom: 'Pas de l’ombre',
    description: 'Après une esquive, se glisse instantanément dans le dos de son attaquant.',
    affinites: ['roublard', 'lancier'],
  },
  riposte: {
    id: 'riposte',
    nom: 'Riposte',
    description: 'Après un blocage, contre-attaque immédiatement sans délai.',
    affinites: ['bretteur', 'lancier'],
  },
  rage: {
    id: 'rage',
    nom: 'Sang chaud',
    description: 'Sous 35 % de ses PV : dégâts +20 % et vitesse +10 % jusqu’à la fin du combat.',
    affinites: ['berserker'],
  },
  carapace: {
    id: 'carapace',
    nom: 'Peau de fer',
    description: 'Sous 35 % de ses PV : sa garde réduit nettement plus les dégâts subis.',
    affinites: ['colosse'],
  },
  vampirisme: {
    id: 'vampirisme',
    nom: 'Soif de sang',
    description: 'Ses coups physiques lui rendent 16 % des dégâts infligés en points de vie.',
    affinites: ['berserker', 'colosse'],
  },
  executeur: {
    id: 'executeur',
    nom: 'Exécuteur',
    description: '+30 % de dégâts contre les adversaires sous 30 % de leurs PV.',
    affinites: ['bretteur', 'roublard'],
  },
  premiersang: {
    id: 'premiersang',
    nom: 'Premier sang',
    description: '+40 % de dégâts pendant les 5 premières secondes du combat.',
    affinites: ['berserker', 'lancier'],
  },
  longueportee: {
    id: 'longueportee',
    nom: 'Bras de fronde',
    description: 'Portée des attaques à distance +30 % et dégâts à distance +15 %.',
    affinites: ['lancier', 'roublard', 'mage'],
  },
  secondevie: {
    id: 'secondevie',
    nom: 'Increvable',
    description: 'La première fois qu’il devrait tomber : reste à 1 PV et devient invincible 1 s.',
    affinites: ['colosse', 'bretteur'],
  },
};

export const TALENT_IDS = Object.keys(TALENTS) as TalentId[];

/** Probabilités de [0, 1, 2] talents selon le palier. */
const NB_TALENTS: Record<Tier, [number, number, number]> = {
  D: [0.9, 0.1, 0],
  C: [0.72, 0.26, 0.02],
  B: [0.5, 0.42, 0.08],
  A: [0.28, 0.55, 0.17],
  S: [0.08, 0.6, 0.32],
  SS: [0, 0.45, 0.55],
};

/** Tire les talents cachés d'un gladiateur (affinités de classe pondérées ×3). */
export function tirerTalents(rng: RNG, tier: Tier, classe: ClassId): TalentId[] {
  const probas = NB_TALENTS[tier];
  const r = rng.next();
  const nb = r < probas[0] ? 0 : r < probas[0] + probas[1] ? 1 : 2;
  const resultat: TalentId[] = [];
  while (resultat.length < nb) {
    const poids = TALENT_IDS.filter((t) => !resultat.includes(t)).flatMap((t) =>
      TALENTS[t].affinites.includes(classe) ? [t, t, t] : [t],
    );
    const choix = rng.pick(poids);
    if (!resultat.includes(choix)) resultat.push(choix);
  }
  return resultat;
}
