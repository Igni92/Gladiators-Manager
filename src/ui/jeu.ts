/** État global de l'UI : partie en cours, navigation entre écrans, auto-save. */

import type { GameState } from '../core/types';
import { sauvegarder } from '../core/save';

export type Ecran =
  | 'titre'
  | 'ville'
  | 'monde'
  | 'arene'
  | 'marche'
  | 'caserne'
  | 'taverne'
  | 'banque'
  | 'infirmerie'
  | 'equipe'
  | 'match';

export interface ParamsEcran {
  /** match.ts : type de match à jouer */
  amical?: boolean;
  /** marche.ts : annonce à ouvrir directement */
  gladiateurId?: number;
}

type RenduEcran = (params: ParamsEcran) => void;

class Jeu {
  etat: GameState | null = null;
  ecran: Ecran = 'titre';
  private rendus = new Map<Ecran, RenduEcran>();

  enregistrer(nom: Ecran, rendu: RenduEcran): void {
    this.rendus.set(nom, rendu);
  }

  aller(nom: Ecran, params: ParamsEcran = {}): void {
    this.ecran = nom;
    const rendu = this.rendus.get(nom);
    if (rendu) rendu(params);
  }

  /** auto-save (appelé après chaque action qui modifie l'état) */
  sauver(): void {
    if (this.etat) sauvegarder(this.etat);
  }

  racine(): HTMLElement {
    const app = document.getElementById('app');
    if (!app) throw new Error('#app introuvable');
    return app;
  }
}

export const jeu = new Jeu();
