/**
 * Races jouables : biais de traits à la GÉNÉRATION (la note globale visée reste
 * la même — une race redistribue les forces, elle ne rend pas meilleur),
 * probabilité d'être mage, et viviers de prénoms par culture.
 */

import type { Genre, RaceId, Traits } from '../core/types';

export interface DefRace {
  id: RaceId;
  nom: string;
  description: string;
  /** biais appliqués aux centres de traits au tirage (±, redistribution) */
  mods: Partial<Traits>;
  /** probabilité qu'un gladiateur de cette race soit mage */
  pMage: number;
  /** poids d'apparition à la génération */
  poids: number;
  /** marge de potentiel bonus (les humains apprennent vite) */
  bonusPotentiel: number;
  prenoms: Record<Genre, string[]>;
}

export const RACES: Record<RaceId, DefRace> = {
  humain: {
    id: 'humain',
    nom: 'Humain',
    description: 'Polyvalents et ambitieux : aucun biais, mais un potentiel de progression supérieur.',
    mods: {},
    pMage: 0.1,
    poids: 28,
    bonusPotentiel: 2,
    prenoms: {
      m: ['Darius', 'Petrus', 'Quintus', 'Tibor', 'Lazlo', 'Hadrien', 'Boris', 'Corvus', 'Nero', 'Tancrede'],
      f: ['Cassia', 'Octavia', 'Roxane', 'Morgane', 'Faustine', 'Cyrielle', 'Demetria', 'Ophelia', 'Selene', 'Enora'],
    },
  },
  elfe: {
    id: 'elfe',
    nom: 'Elfe',
    description: 'Graciles et insaisissables : esquive et vitesse accrues, mais moins de force brute.',
    mods: { esquive: 5, vitesse: 4, force: -4 },
    pMage: 0.16,
    poids: 15,
    bonusPotentiel: 0,
    prenoms: {
      m: ['Aelar', 'Faelar', 'Sylvandir', 'Erevan', 'Lúthien', 'Caelum', 'Théandril', 'Vaeril', 'Ilyan', 'Solenor'],
      f: ['Aerith', 'Lyrielle', 'Naïlo', 'Sylvaine', 'Eolande', 'Théalia', 'Miriel', 'Anhelle', 'Célofine', 'Yavanna'],
    },
  },
  nain: {
    id: 'nain',
    nom: 'Nain',
    description: 'Trapus et têtus : force et discipline de fer (blocage), mais des jambes courtes.',
    mods: { force: 5, intelligence: 3, vitesse: -5 },
    pMage: 0.06,
    poids: 15,
    bonusPotentiel: 0,
    prenoms: {
      m: ['Borin', 'Thrandor', 'Grimnir', 'Dwalik', 'Morgrim', 'Kazmuk', 'Hardek', 'Brogan', 'Durgan', 'Othrek'],
      f: ['Brunhilde', 'Dagna', 'Morgha', 'Thressa', 'Karda', 'Ulfhild', 'Sigrun', 'Bera', 'Drusilde', 'Vondra'],
    },
  },
  orc: {
    id: 'orc',
    nom: 'Orc',
    description: 'Montagnes de muscles à la peau verte : force colossale, tactique sommaire.',
    mods: { force: 6, intelligence: -5 },
    pMage: 0.04,
    poids: 15,
    bonusPotentiel: 0,
    prenoms: {
      m: ['Grommash', 'Urzog', 'Karguk', 'Mokresh', 'Drogath', 'Bhorg', 'Zugor', 'Nargash', 'Thokk', 'Ragmar'],
      f: ['Gorka', 'Shazka', 'Urzula', 'Mogra', 'Ketza', 'Varga', 'Drekka', 'Zinba', 'Norgha', 'Tazga'],
    },
  },
  gobelin: {
    id: 'gobelin',
    nom: 'Gobelin',
    description: 'Petits, vicieux et très difficiles à attraper : fourberie et esquive, force dérisoire.',
    mods: { fourberie: 5, esquive: 4, force: -6 },
    pMage: 0.08,
    poids: 13,
    bonusPotentiel: 0,
    prenoms: {
      m: ['Snikkit', 'Grizzle', 'Patacrok', 'Fizzbang', 'Krapule', 'Mordillo', 'Zigzag', 'Raknik', 'Pikpok', 'Sournix'],
      f: ['Zilly', 'Krapotte', 'Vrille', 'Smiqua', 'Nyxette', 'Grimelle', 'Pestoche', 'Fouina', 'Tiktika', 'Mornille'],
    },
  },
  drakeide: {
    id: 'drakeide',
    nom: 'Drakéide',
    description: 'Sang de dragon : affinité magique rare et écailles solides, mais une carrure qui esquive mal.',
    mods: { force: 3, esquive: -3 },
    pMage: 0.2,
    poids: 14,
    bonusPotentiel: 0,
    prenoms: {
      m: ['Balasar', 'Kriv', 'Rhogar', 'Torinn', 'Sharvex', 'Andraste', 'Vexarion', 'Drazhar', 'Mehen', 'Ozyrith'],
      f: ['Akra', 'Sora', 'Vezera', 'Nala', 'Pyrith', 'Kavarah', 'Yrsavex', 'Thymara', 'Ezria', 'Solyndra'],
    },
  },
};

export const RACE_IDS = Object.keys(RACES) as RaceId[];

export const NOMS_RACES: Record<RaceId, string> = {
  humain: 'Humain',
  elfe: 'Elfe',
  nain: 'Nain',
  orc: 'Orc',
  gobelin: 'Gobelin',
  drakeide: 'Drakéide',
};

export const ICONES_RACES: Record<RaceId, string> = {
  humain: '🧑',
  elfe: '🧝',
  nain: '🧔',
  orc: '👹',
  gobelin: '👺',
  drakeide: '🐲',
};
