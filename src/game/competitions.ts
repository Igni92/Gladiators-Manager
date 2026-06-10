/**
 * Compétitions : ligues nationales (3 divisions de 8, montée/descente),
 * Coupe du Royaume (élimination directe, 16 équipes), Tournoi des Champions
 * (international, 8 équipes, débloqué par la réputation).
 *
 * Calendrier d'une saison (30 semaines) :
 *  S1-S2   : fenêtre de transfert (pré-saison) + amicaux
 *  S3-S16  : 14 journées de ligue
 *  S17-S18 : fenêtre de transfert (mi-saison) + amicaux
 *  S19-S22 : Coupe du Royaume (8e, quart, demi, finale)
 *  S23     : semaine libre
 *  S24-S26 : Tournoi des Champions (quart, demi, finale) si réputation suffisante
 *  S27-S30 : intersaison : fenêtre de transfert, vieillissement, bilan
 */

import { RNG } from '../core/rng';
import type { CoupeState, GameState, Journee, LigueState, MatchResult, PhaseSemaine, Team } from '../core/types';
import { BALANCE } from '../data/balance';

export const SEMAINES_SAISON = 30;
export const SEMAINES_MARCHE: number[] = [1, 2, 17, 18, 27, 28, 29, 30];
export const SEMAINE_LIGUE_DEBUT = 3;
export const SEMAINES_COUPE: number[] = [19, 20, 21, 22];
export const SEMAINES_INTL: number[] = [24, 25, 26];

export function marcheOuvert(semaine: number): boolean {
  return SEMAINES_MARCHE.includes(semaine);
}

/** Calendrier round-robin (algorithme du cercle) : 14 journées pour 8 équipes (aller-retour). */
export function genererCalendrierLigue(equipes: number[], rng: RNG): Journee[] {
  const n = equipes.length; // 8
  const ids = rng.shuffle([...equipes]);
  const fixe = ids[0] as number;
  let rotation = ids.slice(1);
  const aller: [number, number][][] = [];
  for (let j = 0; j < n - 1; j++) {
    const matchs: [number, number][] = [];
    const ligne = [fixe, ...rotation];
    for (let i = 0; i < n / 2; i++) {
      const a = ligne[i] as number;
      const b = ligne[n - 1 - i] as number;
      matchs.push(j % 2 === 0 ? [a, b] : [b, a]);
    }
    aller.push(matchs);
    rotation = [rotation[rotation.length - 1] as number, ...rotation.slice(0, -1)];
  }
  const journees: Journee[] = [];
  aller.forEach((matchs, i) => {
    journees.push({ semaine: SEMAINE_LIGUE_DEBUT + i, matchs, joue: false });
  });
  aller.forEach((matchs, i) => {
    journees.push({
      semaine: SEMAINE_LIGUE_DEBUT + (n - 1) + i,
      matchs: matchs.map(([a, b]) => [b, a] as [number, number]),
      joue: false,
    });
  });
  return journees;
}

export interface LigneClassement {
  equipeId: number;
  pts: number;
  j: number;
  g: number;
  n: number;
  p: number;
  plus: number;
  moins: number;
}

/** Classement d'une division à partir des résultats de la saison courante. */
export function classement(etat: GameState, ligue: LigueState): LigneClassement[] {
  const lignes = new Map<number, LigneClassement>();
  for (const id of ligue.equipes) {
    lignes.set(id, { equipeId: id, pts: 0, j: 0, g: 0, n: 0, p: 0, plus: 0, moins: 0 });
  }
  for (const r of etat.resultats) {
    if (r.saison !== etat.saison || r.competition !== 'ligue') continue;
    const dom = lignes.get(r.domId);
    const ext = lignes.get(r.extId);
    if (!dom || !ext) continue;
    dom.j++;
    ext.j++;
    dom.plus += r.scoreDom;
    dom.moins += r.scoreExt;
    ext.plus += r.scoreExt;
    ext.moins += r.scoreDom;
    if (r.scoreDom > r.scoreExt) {
      dom.pts += 3;
      dom.g++;
      ext.p++;
    } else if (r.scoreDom < r.scoreExt) {
      ext.pts += 3;
      ext.g++;
      dom.p++;
    } else {
      dom.pts++;
      ext.pts++;
      dom.n++;
      ext.n++;
    }
  }
  return [...lignes.values()].sort(
    (a, b) => b.pts - a.pts || (b.plus - b.moins) - (a.plus - a.moins) || b.plus - a.plus || a.equipeId - b.equipeId,
  );
}

/** Les 16 qualifiés pour la Coupe : D1 entière + top 4 de D2 et de D3 (classement à la semaine 18). */
export function qualifiesCoupe(etat: GameState): number[] {
  const ids: number[] = [];
  const l1 = etat.ligues[0];
  if (l1) ids.push(...l1.equipes);
  for (const div of [1, 2]) {
    const ligue = etat.ligues[div];
    if (!ligue) continue;
    const cl = classement(etat, ligue);
    ids.push(...cl.slice(0, 4).map((l) => l.equipeId));
  }
  return ids;
}

export function creerCoupe(etat: GameState, rng: RNG): CoupeState {
  const qualifies = rng.shuffle(qualifiesCoupe(etat));
  const matchs: [number, number][] = [];
  for (let i = 0; i < 16; i += 2) matchs.push([qualifies[i] as number, qualifies[i + 1] as number]);
  return {
    nom: 'Coupe du Royaume',
    competition: 'coupe',
    qualifies,
    tours: [
      { semaine: SEMAINES_COUPE[0] as number, matchs, joue: false },
      { semaine: SEMAINES_COUPE[1] as number, matchs: [], joue: false },
      { semaine: SEMAINES_COUPE[2] as number, matchs: [], joue: false },
      { semaine: SEMAINES_COUPE[3] as number, matchs: [], joue: false },
    ],
    tourActuel: 0,
    termine: false,
  };
}

/** Tournoi international : le joueur (si réputation ≥ seuil) + équipes étrangères d'élite. */
export function creerInternational(participants: number[], rng: RNG): CoupeState {
  const ids = rng.shuffle([...participants]);
  const matchs: [number, number][] = [];
  for (let i = 0; i < 8; i += 2) matchs.push([ids[i] as number, ids[i + 1] as number]);
  return {
    nom: 'Tournoi des Champions',
    competition: 'international',
    qualifies: ids,
    tours: [
      { semaine: SEMAINES_INTL[0] as number, matchs, joue: false },
      { semaine: SEMAINES_INTL[1] as number, matchs: [], joue: false },
      { semaine: SEMAINES_INTL[2] as number, matchs: [], joue: false },
    ],
    tourActuel: 0,
    termine: false,
  };
}

/** Fait avancer la coupe : remplit le tour suivant avec les vainqueurs. */
export function avancerCoupe(coupe: CoupeState, vainqueurs: number[]): void {
  const tour = coupe.tours[coupe.tourActuel];
  if (tour) tour.joue = true;
  coupe.tourActuel++;
  if (coupe.tourActuel >= coupe.tours.length) {
    coupe.termine = true;
    coupe.qualifies = vainqueurs;
    return;
  }
  const suivant = coupe.tours[coupe.tourActuel];
  if (suivant) {
    const matchs: [number, number][] = [];
    for (let i = 0; i + 1 < vainqueurs.length; i += 2) {
      matchs.push([vainqueurs[i] as number, vainqueurs[i + 1] as number]);
    }
    suivant.matchs = matchs;
  }
  coupe.qualifies = vainqueurs;
}

/** Quelle est la phase de la semaine courante pour le JOUEUR ? */
export function phaseSemaine(etat: GameState): PhaseSemaine {
  const s = etat.semaine;
  if (marcheOuvert(s)) return { type: 'marche' };
  const joueurId = etat.equipeJoueurId;
  const ligue = etat.ligues.find((l) => l.equipes.includes(joueurId));
  if (ligue) {
    const idx = ligue.journees.findIndex((j) => j.semaine === s);
    if (idx >= 0) return { type: 'ligue', journee: idx };
  }
  if (etat.coupe && !etat.coupe.termine) {
    const t = etat.coupe.tours[etat.coupe.tourActuel];
    if (t && t.semaine === s && t.matchs.some(([a, b]) => a === joueurId || b === joueurId)) {
      return { type: 'coupe', tour: etat.coupe.tourActuel };
    }
  }
  if (etat.international && !etat.international.termine) {
    const t = etat.international.tours[etat.international.tourActuel];
    if (t && t.semaine === s && t.matchs.some(([a, b]) => a === joueurId || b === joueurId)) {
      return { type: 'international', tour: etat.international.tourActuel };
    }
  }
  return { type: 'libre' };
}

/** Le match du joueur prévu cette semaine, s'il existe. */
export function matchDuJoueur(etat: GameState): { adversaireId: number; competition: 'ligue' | 'coupe' | 'international'; domicile: boolean } | null {
  const phase = phaseSemaine(etat);
  const joueurId = etat.equipeJoueurId;
  if (phase.type === 'ligue') {
    const ligue = etat.ligues.find((l) => l.equipes.includes(joueurId));
    const journee = ligue?.journees[phase.journee];
    if (journee && !journee.joue) {
      for (const [a, b] of journee.matchs) {
        if (a === joueurId) return { adversaireId: b, competition: 'ligue', domicile: true };
        if (b === joueurId) return { adversaireId: a, competition: 'ligue', domicile: false };
      }
    }
  } else if (phase.type === 'coupe' && etat.coupe) {
    const tour = etat.coupe.tours[phase.tour];
    if (tour && !tour.joue) {
      for (const [a, b] of tour.matchs) {
        if (a === joueurId) return { adversaireId: b, competition: 'coupe', domicile: true };
        if (b === joueurId) return { adversaireId: a, competition: 'coupe', domicile: false };
      }
    }
  } else if (phase.type === 'international' && etat.international) {
    const tour = etat.international.tours[phase.tour];
    if (tour && !tour.joue) {
      for (const [a, b] of tour.matchs) {
        if (a === joueurId) return { adversaireId: b, competition: 'international', domicile: true };
        if (b === joueurId) return { adversaireId: a, competition: 'international', domicile: false };
      }
    }
  }
  return null;
}

/** Libellé court d'une semaine du calendrier (pour l'écran calendrier). */
export function libelleSemaine(etat: GameState, semaine: number): string {
  if (marcheOuvert(semaine)) {
    return semaine >= 27 ? 'Intersaison — marché ouvert' : 'Fenêtre de transfert';
  }
  const joueurId = etat.equipeJoueurId;
  const ligue = etat.ligues.find((l) => l.equipes.includes(joueurId));
  if (ligue) {
    const j = ligue.journees.findIndex((jj) => jj.semaine === semaine);
    if (j >= 0) return `Ligue — journée ${j + 1}`;
  }
  if (SEMAINES_COUPE.includes(semaine)) {
    const noms = ['Coupe — 8es de finale', 'Coupe — quarts', 'Coupe — demi-finales', 'Coupe — FINALE'];
    return noms[SEMAINES_COUPE.indexOf(semaine)] ?? 'Coupe';
  }
  if (SEMAINES_INTL.includes(semaine)) {
    const noms = ['Champions — quarts', 'Champions — demi-finales', 'Champions — FINALE'];
    return noms[SEMAINES_INTL.indexOf(semaine)] ?? 'International';
  }
  return 'Semaine libre — entraînement / amical';
}

/** Prime de ligue pour un résultat donné. */
export function primeLigue(division: number, resultat: 'v' | 'n' | 'd'): number {
  const primes = BALANCE.primesLigue[Math.max(0, Math.min(2, division))];
  if (!primes) return 0;
  return primes[resultat];
}

export function dernierResultatContre(etat: GameState, equipeA: number, equipeB: number): MatchResult | null {
  for (let i = etat.resultats.length - 1; i >= 0; i--) {
    const r = etat.resultats[i];
    if (!r) continue;
    if ((r.domId === equipeA && r.extId === equipeB) || (r.domId === equipeB && r.extId === equipeA)) return r;
  }
  return null;
}

export function nomEquipe(etat: GameState, id: number): string {
  return etat.equipes[id]?.nom ?? '???';
}

export function equipeJoueur(etat: GameState): Team {
  const e = etat.equipes[etat.equipeJoueurId];
  if (!e) throw new Error('équipe joueur introuvable');
  return e;
}
