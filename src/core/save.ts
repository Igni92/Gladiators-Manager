/** Sauvegarde localStorage : auto-save après chaque action de jeu. */

import type { GameState } from './types';
import { VERSION_SAVE } from '../game/etat';
import { RNG } from './rng';
import { tirerTalents } from '../data/talents';
import { noteGlobale } from '../game/generation';
import { tierDe } from '../data/balance';
import { tirerRace } from '../game/generation';

const CLE = 'gladiators_manager_save_v1';

export function sauvegarder(etat: GameState): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch (e) {
    console.warn('Sauvegarde impossible', e);
  }
}

export function chargerSauvegarde(): GameState | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const etat = JSON.parse(brut) as GameState;
    if (typeof etat.version !== 'number' || etat.version > VERSION_SAVE) return null;
    migrer(etat);
    return etat;
  } catch {
    return null;
  }
}

/** Migrations v1 → v2 → v3 : talents cachés, placements, races et genres. */
function migrer(etat: GameState): void {
  if (etat.version >= VERSION_SAVE) return;
  const rng = new RNG((etat.rngState ?? 1) >>> 0);
  if (!etat.placements) etat.placements = {};
  for (const idStr of Object.keys(etat.gladiateurs)) {
    const g = etat.gladiateurs[Number(idStr)];
    if (!g) continue;
    if (!g.talents) {
      g.talents = tirerTalents(rng, tierDe(noteGlobale(g.traits, g.classe)), g.classe);
      g.talentsConnus = [];
    }
    if (!g.race) {
      g.race = tirerRace(rng);
      g.genre = rng.chance(0.5) ? 'm' : 'f';
    }
  }
  etat.rngState = Math.floor(rng.next() * 4294967296) >>> 0;
  etat.version = VERSION_SAVE;
}

export function effacerSauvegarde(): void {
  localStorage.removeItem(CLE);
}

export function aUneSauvegarde(): boolean {
  return localStorage.getItem(CLE) !== null;
}
