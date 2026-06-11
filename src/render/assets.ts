/** Chargement des assets pré-rendus (spritesheets, portraits, bâtiments, arène, UI). */

import type { AnimId } from '../game/combat';
import type { ClassId, Genre, RaceId } from '../core/types';

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

  /** Charge une image si elle existe (sans erreur si absente). */
  chargerImageOptionnelle(cle: string, url: string): Promise<void> {
    if (this.images.has(cle)) return Promise.resolve();
    return this.chargerImage(cle, url);
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

  /** Portrait racial v3 ; l'appelant branche onerror → portraitUrl() en repli. */
  portraitUrlRace(race: RaceId, genre: Genre, classe: ClassId): string {
    return `${import.meta.env.BASE_URL}assets/portraits/${race}_${genre}_${classe}.png`;
  }

  /** Charge à la demande la spritesheet raciale {race}_{classe} (combat). */
  async chargerSpriteRace(race: RaceId, classe: ClassId): Promise<void> {
    const cle = `${race}_${classe}`;
    if (this.images.has(`sprite_${cle}`) || this.spritesAbsents.has(cle)) return;
    const base = import.meta.env.BASE_URL + 'assets/';
    try {
      const rep = await fetch(`${base}sprites/${cle}.json`);
      if (!rep.ok) throw new Error('absent');
      const atlas = (await rep.json()) as Atlas;
      await this.chargerImage(`sprite_${cle}`, `${base}sprites/${cle}.png`);
      if (this.images.has(`sprite_${cle}`)) this.atlas.set(cle, atlas);
      else this.spritesAbsents.add(cle);
    } catch {
      this.spritesAbsents.add(cle);
    }
  }

  private spritesAbsents = new Set<string>();

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
    race?: RaceId,
  ): boolean {
    // feuille raciale si disponible, sinon repli sur la feuille de classe
    const cleRace = race ? `${race}_${classe}` : null;
    let img = cleRace ? this.images.get(`sprite_${cleRace}`) : undefined;
    let atlas = cleRace ? this.atlas.get(cleRace) : undefined;
    if (!img || !atlas) {
      img = this.images.get(`sprite_${classe}`);
      atlas = this.atlas.get(classe);
    }
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
