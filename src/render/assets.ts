/** Chargement des assets pré-rendus (spritesheets, portraits, bâtiments, arène, UI). */

import type { AnimId } from '../game/combat';
import type { ClassId } from '../core/types';

export interface LigneAtlas {
  dir: 'S' | 'E' | 'N' | 'W';
  anim: string;
  row: number;
  frames: number;
}

export interface Atlas {
  cell: number;
  rows: LigneAtlas[];
}

const CLASSES: ClassId[] = ['colosse', 'bretteur', 'roublard', 'lancier', 'mage', 'berserker'];
const BATIMENTS = ['arene', 'marche', 'caserne', 'taverne', 'banque', 'infirmerie', 'fontaine', 'arbre_a', 'arbre_b', 'statue', 'puits', 'caisses', 'charrette', 'lampe', 'buisson', 'sol_ville'];

/** Échelle d'affichage relative par classe (le colosse est rendu avec une caméra plus large). */
export const ECHELLE_CLASSE: Record<ClassId, number> = {
  colosse: 1.95 / 1.6,
  bretteur: 1.0,
  roublard: 1.42 / 1.6,
  lancier: 1.78 / 1.6,
  mage: 1.72 / 1.6,
  berserker: 1.78 / 1.6,
};

export class Assets {
  images = new Map<string, HTMLImageElement>();
  atlas = new Map<string, Atlas>();
  pret = false;

  async charger(): Promise<void> {
    const base = import.meta.env.BASE_URL + 'assets/';
    const taches: Promise<void>[] = [];
    for (const c of CLASSES) {
      taches.push(this.chargerImage(`sprite_${c}`, `${base}sprites/${c}.png`));
      taches.push(
        fetch(`${base}sprites/${c}.json`)
          .then((r) => r.json())
          .then((a: Atlas) => {
            this.atlas.set(c, a);
          })
          .catch(() => {}),
      );
      for (let v = 0; v < 3; v++) {
        taches.push(this.chargerImage(`portrait_${c}_${v}`, `${base}portraits/${c}_${v}.png`));
      }
    }
    for (const b of BATIMENTS) taches.push(this.chargerImage(`bat_${b}`, `${base}buildings/${b}.png`));
    taches.push(this.chargerImage('arena_bg', `${base}arena/arena_bg.png`));
    taches.push(this.chargerImage('title_hero', `${base}ui/title_hero.png`));
    taches.push(this.chargerImage('icon', `${base}ui/icon.png`));
    await Promise.all(taches);
    this.pret = true;
  }

  private chargerImage(cle: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(cle, img);
        resolve();
      };
      img.onerror = () => resolve(); // asset manquant → fallback dessiné
      img.src = url;
    });
  }

  image(cle: string): HTMLImageElement | undefined {
    return this.images.get(cle);
  }

  portraitUrl(classe: ClassId, variante: number): string {
    return `${import.meta.env.BASE_URL}assets/portraits/${classe}_${variante % 3}.png`;
  }

  /**
   * Dessine une frame de sprite de combat.
   * `taille` = hauteur affichée du personnage standard (l'échelle de classe s'applique en plus).
   */
  dessinerSprite(
    ctx: CanvasRenderingContext2D,
    classe: ClassId,
    anim: AnimId,
    dir: 'S' | 'E' | 'N' | 'W',
    frame: number,
    x: number,
    y: number,
    taille: number,
  ): boolean {
    const img = this.images.get(`sprite_${classe}`);
    const atlas = this.atlas.get(classe);
    if (!img || !atlas) return false;
    const ligne = atlas.rows.find((r) => r.dir === dir && r.anim === anim) ?? atlas.rows.find((r) => r.dir === dir && r.anim === 'idle');
    if (!ligne) return false;
    const f = Math.max(0, Math.min(ligne.frames - 1, frame));
    const c = atlas.cell;
    const t = taille * ECHELLE_CLASSE[classe];
    // le personnage occupe ~85 % de la cellule, ancré au sol vers le bas de la cellule
    ctx.drawImage(img, f * c, ligne.row * c, c, c, x - t / 2, y - t * 0.78, t, t);
    return true;
  }
}

export const assets = new Assets();
