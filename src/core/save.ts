/** Sauvegarde localStorage : auto-save après chaque action de jeu. */

import type { GameState } from './types';
import { VERSION_SAVE } from '../game/etat';

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
    return etat;
  } catch {
    return null;
  }
}

export function effacerSauvegarde(): void {
  localStorage.removeItem(CLE);
}

export function aUneSauvegarde(): boolean {
  return localStorage.getItem(CLE) !== null;
}
