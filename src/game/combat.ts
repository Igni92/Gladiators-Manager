/**
 * Moteur de combat 3 contre 3, vue de dessus — v2 « arène tactique ».
 *
 * Déroulement façon AFK Arena : on PLACE ses gladiateurs sur sa moitié
 * d'arène (9 emplacements : 3 colonnes avant/centre/arrière × 3 lignes),
 * puis le combat se déroule en simulation automatique. On peut toujours
 * donner des consignes en direct et « Passer ».
 *
 * Usage des 6 traits (documenté dans EQUILIBRAGE.md) :
 *  - Force        → dégâts mêlée + points de vie
 *  - Vitesse      → vitesse de déplacement + cadence d'attaque
 *  - Intelligence → temps de réaction, choix de cible, garde, BLOCAGE
 *                   (le blocage est bien plus efficace contre les attaques à distance)
 *  - Fourberie    → critiques + dégâts/portée des ATTAQUES À DISTANCE
 *                   (couteaux du roublard, javelots du lancier)
 *  - Esquive      → esquive (moitié moins efficace contre les projectiles)
 *  - Magie        → ≥ 60 : sorts (boule de feu, nova, soin)
 * Plus les TALENTS CACHÉS (fumigène, dash, riposte…) qui se déclenchent sur
 * des événements (esquive, blocage, PV bas, coup fatal…).
 */

import { RNG } from '../core/rng';
import type { ClassId, Gladiator, TalentId } from '../core/types';
import { BALANCE } from '../data/balance';
import { multiplicateurCondition } from './economie';
import { noteGlobale } from './generation';

export type Consigne = 'equilibre' | 'agressif' | 'defensif' | 'magie';

export type AnimId = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'death';

/** Modificateurs d'arme/carrure par classe. */
const MODS_CLASSE: Record<ClassId, { deg: number; pv: number; portee: number; tireur: boolean; bouclier: boolean }> = {
  colosse: { deg: 1.05, pv: 1.05, portee: 40, tireur: false, bouclier: true },
  bretteur: { deg: 1.0, pv: 1.05, portee: 38, tireur: false, bouclier: true },
  roublard: { deg: 1.05, pv: 0.92, portee: 34, tireur: true, bouclier: false },
  lancier: { deg: 0.95, pv: 0.95, portee: 58, tireur: true, bouclier: true },
  mage: { deg: 0.7, pv: 0.8, portee: 36, tireur: false, bouclier: false },
  berserker: { deg: 1.06, pv: 1.0, portee: 38, tireur: false, bouclier: false },
};

export interface UniteCombat {
  gid: number;
  equipe: 0 | 1;
  nom: string;
  classe: ClassId;
  teinte: number;
  x: number;
  y: number;
  angle: number;
  pv: number;
  pvMax: number;
  vivant: boolean;
  // attributs dérivés (état moral/forme/salaire/forme du jour inclus)
  deg: number;
  portee: number;
  cdAttaque: number;
  vitDepl: number;
  pEsquive: number;
  pCrit: number;
  garde: number;
  pBloc: number;
  magie: number;
  intelligence: number;
  fourberie: number;
  estMage: boolean;
  estTireur: boolean;
  porteeDist: number;
  degDist: number;
  // talents
  talents: TalentId[];
  talentsDeclenches: TalentId[];
  invincibleT: number;
  rageActive: boolean;
  carapaceActive: boolean;
  secondeVieDispo: boolean;
  // timers
  tAttaque: number;
  tAttaqueDist: number;
  tFeu: number;
  tNova: number;
  tSoin: number;
  tDecision: number;
  cibleIdx: number;
  anim: AnimId;
  animT: number;
  // stats du combat
  elims: number;
  degatsInfliges: number;
  soinsRendus: number;
}

export type TypeProjectile = 'feu' | 'couteau' | 'javelot';

export interface Projectile {
  x: number;
  y: number;
  cibleIdx: number;
  deg: number;
  equipe: 0 | 1;
  lanceurIdx: number;
  type: TypeProjectile;
  angle: number;
  vivant: boolean;
}

export type EvtCombat =
  | { type: 'coup'; cibleIdx: number; deg: number; crit: boolean }
  | { type: 'esquive'; cibleIdx: number }
  | { type: 'bloc'; cibleIdx: number }
  | { type: 'immunise'; cibleIdx: number }
  | { type: 'tir'; deIdx: number; projectile: TypeProjectile }
  | { type: 'feu'; deIdx: number }
  | { type: 'impactProj'; x: number; y: number; cibleIdx: number; deg: number; projectile: TypeProjectile }
  | { type: 'nova'; deIdx: number; x: number; y: number; rayon: number }
  | { type: 'soin'; deIdx: number; cibleIdx: number; pv: number }
  | { type: 'talent'; idx: number; talent: TalentId }
  | { type: 'mort'; cibleIdx: number; parIdx: number }
  | { type: 'fin'; vainqueur: -1 | 0 | 1 };

export interface CombatState {
  unites: UniteCombat[];
  projectiles: Projectile[];
  /** événements émis pendant le DERNIER tick (drainés par le rendu) */
  evts: EvtCombat[];
  t: number;
  termine: boolean;
  vainqueur: -1 | 0 | 1;
  consignes: [Consigne, Consigne];
  focus: [number, number];
  rng: RNG;
}

export const ARENE = { cx: 500, cy: 500, rayon: 392 };

/**
 * Grille de placement : 9 emplacements par camp.
 * slot = colonne (0 = avant, 1 = centre, 2 = arrière) + 3 × ligne (0 = haut).
 */
export function posDepuisSlot(equipe: 0 | 1, slot: number): { x: number; y: number } {
  const col = slot % 3;
  const ligne = Math.floor(slot / 3);
  const dx = 130 + col * 100;
  return {
    x: equipe === 0 ? ARENE.cx - dx : ARENE.cx + dx,
    y: ARENE.cy + (ligne - 1) * 135,
  };
}

/** Placement par défaut selon la classe : cogneurs devant, tireurs au centre, mages derrière. */
export function placementAuto(glads: Gladiator[]): number[] {
  const colonne: Record<ClassId, number> = { colosse: 0, berserker: 0, bretteur: 0, lancier: 1, roublard: 1, mage: 2 };
  const ordreLignes = [1, 0, 2]; // ligne du milieu d'abord
  const occupes = new Set<number>();
  return glads.slice(0, 3).map((g) => {
    const col = colonne[g.classe];
    for (const ligne of ordreLignes) {
      const slot = ligne * 3 + col;
      if (!occupes.has(slot)) {
        occupes.add(slot);
        return slot;
      }
    }
    for (let i = 0; i < 9; i++) {
      if (!occupes.has(i)) {
        occupes.add(i);
        return i;
      }
    }
    return 4;
  });
}

function creerUnite(g: Gladiator, equipe: 0 | 1, slot: number, rng: RNG): UniteCombat {
  // « forme du jour » : variance par combat pour que l'issue ne soit pas écrite d'avance
  const mult = multiplicateurCondition(g) * rng.range(0.92, 1.08);
  const mc = MODS_CLASSE[g.classe];
  const t = g.traits;
  const pvMax = Math.round((BALANCE.PV_BASE + t.force * BALANCE.PV_FORCE + noteGlobale(t, g.classe) * BALANCE.PV_OVR) * mc.pv * (0.9 + 0.1 * mult));
  const pos = posDepuisSlot(equipe, slot);
  const talents = g.talents ?? [];
  const fPortee = talents.includes('longueportee') ? BALANCE.T_LONGUEPORTEE_PORTEE : 1;
  const fDegDist = talents.includes('longueportee') ? BALANCE.T_LONGUEPORTEE_DEG : 1;
  return {
    gid: g.id,
    equipe,
    nom: g.nom,
    classe: g.classe,
    teinte: g.teinte,
    x: pos.x,
    y: pos.y,
    angle: equipe === 0 ? 0 : Math.PI,
    pv: pvMax,
    pvMax,
    vivant: true,
    deg: (BALANCE.DEG_BASE + t.force * BALANCE.DEG_FORCE) * mc.deg * mult,
    portee: mc.portee,
    cdAttaque: Math.max(0.8, BALANCE.ATT_CD_BASE - t.vitesse * BALANCE.ATT_CD_PENTE),
    vitDepl: (BALANCE.DEPL_BASE + t.vitesse * BALANCE.DEPL_PENTE) * (0.92 + 0.08 * mult),
    pEsquive: Math.min(BALANCE.ESQ_CAP, t.esquive * BALANCE.ESQ_PENTE),
    pCrit: t.fourberie * BALANCE.CRIT_PENTE,
    garde: t.intelligence * BALANCE.GARDE_PENTE,
    pBloc: Math.min(BALANCE.BLOC_CAP, t.intelligence * BALANCE.BLOC_PENTE * (mc.bouclier ? BALANCE.BLOC_BOUCLIER : 1)),
    magie: t.magie,
    intelligence: t.intelligence,
    fourberie: t.fourberie,
    estMage: t.magie >= BALANCE.SEUIL_MAGE,
    estTireur: mc.tireur,
    porteeDist: (BALANCE.DIST_PORTEE + (g.classe === 'lancier' ? 30 : 0)) * fPortee,
    degDist: (BALANCE.DIST_BASE + t.fourberie * BALANCE.DIST_FOURBERIE) * mult * fDegDist,
    talents,
    talentsDeclenches: [],
    invincibleT: 0,
    rageActive: false,
    carapaceActive: false,
    secondeVieDispo: talents.includes('secondevie'),
    tAttaque: 0.6,
    tAttaqueDist: 0.9,
    tFeu: 1.2,
    tNova: 5,
    tSoin: 3,
    tDecision: 0,
    cibleIdx: -1,
    anim: 'idle',
    animT: 0,
    elims: 0,
    degatsInfliges: 0,
    soinsRendus: 0,
  };
}

export function creerCombat(
  equipeA: Gladiator[],
  equipeB: Gladiator[],
  seed: number,
  placementA?: number[],
  placementB?: number[],
): CombatState {
  const rng = new RNG(seed);
  const slotsA = placementA && placementA.length >= Math.min(3, equipeA.length) ? placementA : placementAuto(equipeA);
  const slotsB = placementB && placementB.length >= Math.min(3, equipeB.length) ? placementB : placementAuto(equipeB);
  const unites: UniteCombat[] = [];
  equipeA.slice(0, 3).forEach((g, i) => unites.push(creerUnite(g, 0, slotsA[i] ?? 4, rng)));
  equipeB.slice(0, 3).forEach((g, i) => unites.push(creerUnite(g, 1, slotsB[i] ?? 4, rng)));
  return {
    unites,
    projectiles: [],
    evts: [],
    t: 0,
    termine: false,
    vainqueur: -1,
    consignes: ['equilibre', 'equilibre'],
    focus: [-1, -1],
    rng,
  };
}

function vivantsDe(cs: CombatState, equipe: 0 | 1): UniteCombat[] {
  return cs.unites.filter((u) => u.vivant && u.equipe === equipe);
}

function declencher(cs: CombatState, u: UniteCombat, talent: TalentId): void {
  if (!u.talentsDeclenches.includes(talent)) u.talentsDeclenches.push(talent);
  cs.evts.push({ type: 'talent', idx: cs.unites.indexOf(u), talent });
}

/** Choix de cible : focus du manager > faible PV (si futé) > la plus proche. */
function choisirCible(cs: CombatState, u: UniteCombat): number {
  const focus = cs.focus[u.equipe];
  if (focus >= 0) {
    const f = cs.unites[focus];
    if (f && f.vivant && f.equipe !== u.equipe) return focus;
  }
  let meilleur = -1;
  let meilleurScore = Infinity;
  for (let i = 0; i < cs.unites.length; i++) {
    const e = cs.unites[i];
    if (!e || !e.vivant || e.equipe === u.equipe) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    const poidsPv = u.intelligence / 100;
    const score = d * (1 - poidsPv * 0.5) + (e.pv / e.pvMax) * 280 * poidsPv;
    if (score < meilleurScore) {
      meilleurScore = score;
      meilleur = i;
    }
  }
  return meilleur;
}

function stanceDeg(cs: CombatState, u: UniteCombat): number {
  const c = cs.consignes[u.equipe];
  if (c === 'agressif') return BALANCE.CONSIGNE_BONUS;
  if (c === 'defensif') return BALANCE.CONSIGNE_MALUS;
  return 1;
}

function stanceDef(cs: CombatState, u: UniteCombat): number {
  const c = cs.consignes[u.equipe];
  if (c === 'agressif') return BALANCE.CONSIGNE_MALUS;
  if (c === 'defensif') return BALANCE.CONSIGNE_BONUS;
  return 1;
}

/** Multiplicateurs de dégâts venant des talents offensifs. */
function multTalentsOffensifs(cs: CombatState, de: UniteCombat, cible: UniteCombat): number {
  let m = 1;
  if (de.rageActive) m *= BALANCE.T_RAGE_DEG;
  if (de.talents.includes('premiersang') && cs.t < BALANCE.T_PREMIERSANG_DUREE) {
    m *= BALANCE.T_PREMIERSANG_DEG;
    declencher(cs, de, 'premiersang');
  }
  if (de.talents.includes('executeur') && cible.pv / cible.pvMax < BALANCE.T_EXECUTEUR_SEUIL) {
    m *= BALANCE.T_EXECUTEUR_DEG;
    declencher(cs, de, 'executeur');
  }
  return m;
}

function infligerDegats(cs: CombatState, de: UniteCombat, cibleIdx: number, brut: number, magique: boolean): void {
  const cible = cs.unites[cibleIdx];
  if (!cible || !cible.vivant) return;
  if (cible.invincibleT > 0) {
    cs.evts.push({ type: 'immunise', cibleIdx });
    return;
  }
  let gardeEff = cible.garde * stanceDef(cs, cible);
  if (cible.carapaceActive) gardeEff += BALANCE.T_CARAPACE_GARDE;
  const reduction = Math.min(0.5, gardeEff * (magique ? 0.5 : 1));
  let deg = Math.max(1, Math.round(brut * (1 - reduction)));
  cible.pv -= deg;
  de.degatsInfliges += deg;

  // vampirisme : les coups physiques soignent l'attaquant
  if (!magique && de.talents.includes('vampirisme') && de.vivant) {
    const soin = Math.round(deg * BALANCE.T_VAMPIRISME);
    if (soin > 0) {
      de.pv = Math.min(de.pvMax, de.pv + soin);
      de.soinsRendus += soin;
      declencher(cs, de, 'vampirisme');
    }
  }

  if (cible.anim !== 'attack' && cible.anim !== 'cast') {
    cible.anim = 'hit';
    cible.animT = 0;
  }

  // seuils de PV : rage / carapace / seconde vie
  if (cible.pv > 0 && cible.pv / cible.pvMax < BALANCE.T_SEUIL_PV) {
    if (cible.talents.includes('rage') && !cible.rageActive) {
      cible.rageActive = true;
      cible.vitDepl *= BALANCE.T_RAGE_VIT;
      declencher(cs, cible, 'rage');
    }
    if (cible.talents.includes('carapace') && !cible.carapaceActive) {
      cible.carapaceActive = true;
      declencher(cs, cible, 'carapace');
    }
  }

  if (cible.pv <= 0) {
    if (cible.secondeVieDispo) {
      cible.secondeVieDispo = false;
      cible.pv = 1;
      cible.invincibleT = BALANCE.T_SECONDEVIE_INVINCIBLE;
      declencher(cs, cible, 'secondevie');
      return;
    }
    cible.pv = 0;
    cible.vivant = false;
    cible.anim = 'death';
    cible.animT = 0;
    de.elims += 1;
    cs.evts.push({ type: 'mort', cibleIdx, parIdx: cs.unites.indexOf(de) });
  }
}

/** Esquive + talents liés (fumigène, dash). Renvoie vrai si l'attaque est évitée. */
function rouleEsquive(cs: CombatState, attaquant: UniteCombat, cible: UniteCombat, distance: boolean): boolean {
  const cibleIdx = cs.unites.indexOf(cible);
  let pEsq = Math.min(BALANCE.ESQ_CAP, cible.pEsquive * stanceDef(cs, cible));
  if (distance) pEsq *= BALANCE.DIST_ESQUIVE_MULT;
  if (!cs.rng.chance(pEsq)) return false;
  cs.evts.push({ type: 'esquive', cibleIdx });
  if (cible.talents.includes('fumigene')) {
    cible.invincibleT = BALANCE.T_FUMIGENE_DUREE;
    declencher(cs, cible, 'fumigene');
  }
  if (cible.talents.includes('dash') && !distance) {
    // se téléporte dans le dos de l'attaquant
    cible.x = attaquant.x - Math.cos(attaquant.angle) * 46;
    cible.y = attaquant.y - Math.sin(attaquant.angle) * 46;
    cible.angle = Math.atan2(attaquant.y - cible.y, attaquant.x - cible.x);
    cible.tAttaque = Math.min(cible.tAttaque, 0.15);
    declencher(cs, cible, 'dash');
  }
  return true;
}

/** Blocage (Intelligence) : bien plus probable contre les attaques à DISTANCE. */
function rouleBloc(cs: CombatState, attaquantIdx: number, cible: UniteCombat, distance: boolean): boolean {
  const pBloc = Math.min(BALANCE.BLOC_CAP, cible.pBloc * (distance ? BALANCE.BLOC_DISTANCE_MULT : 1));
  if (!cs.rng.chance(pBloc)) return false;
  cs.evts.push({ type: 'bloc', cibleIdx: cs.unites.indexOf(cible) });
  // riposte : contre-attaque immédiate après un blocage (au contact uniquement)
  const attaquant = cs.unites[attaquantIdx];
  if (cible.talents.includes('riposte') && attaquant && attaquant.vivant && !distance) {
    declencher(cs, cible, 'riposte');
    const brut = cible.deg * stanceDeg(cs, cible) * 0.8;
    cs.evts.push({ type: 'coup', cibleIdx: attaquantIdx, deg: Math.round(brut), crit: false });
    infligerDegats(cs, cible, attaquantIdx, brut, false);
  }
  return true;
}

function attaqueMelee(cs: CombatState, u: UniteCombat, cibleIdx: number): void {
  const cible = cs.unites[cibleIdx];
  if (!cible || !cible.vivant) return;
  u.tAttaque = u.cdAttaque * cs.rng.range(0.9, 1.1);
  u.anim = 'attack';
  u.animT = 0;
  if (rouleEsquive(cs, u, cible, false)) return;
  const blocage = rouleBloc(cs, cs.unites.indexOf(u), cible, false);
  // critique : fourberie, renforcée dans le dos
  const angVers = Math.atan2(u.y - cible.y, u.x - cible.x);
  let diff = Math.abs(angVers - cible.angle) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  const dansLeDos = diff < Math.PI / 2.5;
  const crit = cs.rng.chance(u.pCrit * (dansLeDos ? 1.6 : 1));
  let brut = u.deg * stanceDeg(cs, u) * (crit ? BALANCE.CRIT_MULT : 1) * cs.rng.range(0.85, 1.15);
  brut *= multTalentsOffensifs(cs, u, cible);
  if (blocage) brut *= BALANCE.BLOC_REDUCTION;
  else cs.evts.push({ type: 'coup', cibleIdx, deg: Math.round(brut), crit });
  infligerDegats(cs, u, cibleIdx, brut, false);
}

/** Tir à distance (roublard : couteaux, lancier : javelots) — puissance liée à la Fourberie. */
function attaqueDistance(cs: CombatState, u: UniteCombat, cibleIdx: number): void {
  const cible = cs.unites[cibleIdx];
  if (!cible || !cible.vivant) return;
  u.tAttaqueDist = u.cdAttaque * BALANCE.DIST_CD_MULT * cs.rng.range(0.9, 1.1);
  u.anim = 'attack';
  u.animT = 0;
  const type: TypeProjectile = u.classe === 'lancier' ? 'javelot' : 'couteau';
  const brut = u.degDist * stanceDeg(cs, u) * cs.rng.range(0.85, 1.15) * multTalentsOffensifs(cs, u, cible);
  cs.projectiles.push({
    x: u.x + Math.cos(u.angle) * 22,
    y: u.y + Math.sin(u.angle) * 22,
    cibleIdx,
    deg: brut,
    equipe: u.equipe,
    lanceurIdx: cs.unites.indexOf(u),
    type,
    angle: u.angle,
    vivant: true,
  });
  cs.evts.push({ type: 'tir', deIdx: cs.unites.indexOf(u), projectile: type });
}

function lancerSorts(cs: CombatState, u: UniteCombat, uIdx: number, cible: UniteCombat, dist: number): boolean {
  const prioMagie = cs.consignes[u.equipe] === 'magie';
  const facteurCd = prioMagie ? 0.8 : 1;
  const fPortee = u.talents.includes('longueportee') ? BALANCE.T_LONGUEPORTEE_PORTEE : 1;

  if (u.tSoin <= 0) {
    let pire: UniteCombat | null = null;
    let pireRatio = prioMagie ? 0.75 : 0.6;
    for (const a of vivantsDe(cs, u.equipe)) {
      const r = a.pv / a.pvMax;
      if (r < pireRatio) {
        pireRatio = r;
        pire = a;
      }
    }
    if (pire) {
      u.tSoin = BALANCE.SOIN_CD * facteurCd;
      u.anim = 'cast';
      u.animT = 0;
      const pv = Math.round(BALANCE.SOIN_BASE + u.magie * BALANCE.SOIN_MAGIE);
      pire.pv = Math.min(pire.pvMax, pire.pv + pv);
      u.soinsRendus += pv;
      cs.evts.push({ type: 'soin', deIdx: uIdx, cibleIdx: cs.unites.indexOf(pire), pv });
      return true;
    }
  }
  if (u.tNova <= 0) {
    const proches = cs.unites.filter((e) => e.vivant && e.equipe !== u.equipe && Math.hypot(e.x - u.x, e.y - u.y) < 95);
    if (proches.length >= 2 || (prioMagie && proches.length >= 1)) {
      u.tNova = BALANCE.NOVA_CD * facteurCd;
      u.anim = 'cast';
      u.animT = 0;
      const brut = (BALANCE.NOVA_BASE + u.magie * BALANCE.NOVA_MAGIE) * stanceDeg(cs, u);
      cs.evts.push({ type: 'nova', deIdx: uIdx, x: u.x, y: u.y, rayon: 95 });
      for (const e of proches) infligerDegats(cs, u, cs.unites.indexOf(e), brut, true);
      return true;
    }
  }
  if (u.tFeu <= 0 && dist < 340 * fPortee) {
    u.tFeu = BALANCE.FEU_CD * facteurCd;
    u.anim = 'cast';
    u.animT = 0;
    cs.projectiles.push({
      x: u.x + Math.cos(u.angle) * 20,
      y: u.y + Math.sin(u.angle) * 20,
      cibleIdx: cs.unites.indexOf(cible),
      deg: (BALANCE.FEU_BASE + u.magie * BALANCE.FEU_MAGIE) * stanceDeg(cs, u) * (u.talents.includes('longueportee') ? BALANCE.T_LONGUEPORTEE_DEG : 1),
      equipe: u.equipe,
      lanceurIdx: uIdx,
      type: 'feu',
      angle: u.angle,
      vivant: true,
    });
    cs.evts.push({ type: 'feu', deIdx: uIdx });
    return true;
  }
  return false;
}

function ramenerDansArene(u: UniteCombat): void {
  const dx = u.x - ARENE.cx;
  const dy = u.y - ARENE.cy;
  const d = Math.hypot(dx, dy);
  const max = ARENE.rayon - 18;
  if (d > max) {
    u.x = ARENE.cx + (dx / d) * max;
    u.y = ARENE.cy + (dy / d) * max;
  }
}

/** Avance la simulation d'un tick (1/30 s). */
export function tickCombat(cs: CombatState): void {
  if (cs.termine) return;
  const dt = BALANCE.TICK;
  cs.evts = [];
  cs.t += dt;

  for (let i = 0; i < cs.unites.length; i++) {
    const u = cs.unites[i];
    if (!u) continue;
    u.animT += dt;
    if (!u.vivant) continue;

    u.tAttaque -= dt;
    u.tAttaqueDist -= dt;
    u.tFeu -= dt;
    u.tNova -= dt;
    u.tSoin -= dt;
    u.tDecision -= dt;
    if (u.invincibleT > 0) u.invincibleT -= dt;

    if ((u.anim === 'attack' || u.anim === 'cast' || u.anim === 'hit') && u.animT > 0.45) {
      u.anim = 'idle';
      u.animT = 0;
    }

    if (u.tDecision <= 0) {
      u.tDecision = Math.max(0.35, 1.25 - u.intelligence * 0.006);
      u.cibleIdx = choisirCible(cs, u);
    }
    const cible = u.cibleIdx >= 0 ? cs.unites[u.cibleIdx] : undefined;
    if (!cible || !cible.vivant) {
      u.cibleIdx = choisirCible(cs, u);
      continue;
    }

    const dx = cible.x - u.x;
    const dy = cible.y - u.y;
    const dist = Math.hypot(dx, dy);
    u.angle = Math.atan2(dy, dx);

    // Mages : sorts + maintien à distance
    if (u.estMage) {
      const aCaste = lancerSorts(cs, u, i, cible, dist);
      if (!aCaste && u.anim !== 'cast') {
        const distVoulue = 230;
        if (dist < distVoulue - 30) {
          u.x -= (dx / dist) * u.vitDepl * 0.55 * dt;
          u.y -= (dy / dist) * u.vitDepl * 0.55 * dt;
          if (u.anim !== 'hit') u.anim = 'walk';
        } else if (dist > distVoulue + 60) {
          u.x += (dx / dist) * u.vitDepl * dt;
          u.y += (dy / dist) * u.vitDepl * dt;
          if (u.anim !== 'hit') u.anim = 'walk';
        } else if (u.anim === 'walk') {
          u.anim = 'idle';
        }
      }
      ramenerDansArene(u);
      continue;
    }

    // Tireurs (roublard/lancier) : harcèlent à distance en se déplaçant ;
    // contre un porteur de bouclier (qui bloque trop bien les projectiles),
    // ils ferment la distance et passent en mêlée.
    if (u.estTireur && dist > u.portee + 30 && dist <= u.porteeDist) {
      if (u.tAttaqueDist <= 0 && u.anim !== 'attack') attaqueDistance(cs, u, u.cibleIdx);
      const cibleBouclier = MODS_CLASSE[cible.classe].bouclier;
      const agressif = cs.consignes[u.equipe] === 'agressif';
      if (!cibleBouclier && !agressif) {
        // cible molle : on garde la distance idéale
        if (dist < 130) {
          u.x -= (dx / dist) * u.vitDepl * 0.55 * dt;
          u.y -= (dy / dist) * u.vitDepl * 0.55 * dt;
          if (u.anim !== 'hit' && u.anim !== 'attack') u.anim = 'walk';
        } else if (u.anim === 'walk') {
          u.anim = 'idle';
        }
        ramenerDansArene(u);
        continue;
      }
      // sinon : on continue d'avancer (le tir au passage est déjà parti)
    }

    // Mêlée : repli défensif si mal en point et arme pas prête
    const defensif = cs.consignes[u.equipe] === 'defensif';
    const replie = defensif && u.pv / u.pvMax < 0.35 && u.tAttaque > 0.4;
    if (replie && dist < 140) {
      u.x -= (dx / dist) * u.vitDepl * 0.8 * dt;
      u.y -= (dy / dist) * u.vitDepl * 0.8 * dt;
      if (u.anim !== 'hit') u.anim = 'walk';
    } else if (dist > u.portee + cible.portee * 0.2) {
      const v = u.rageActive ? u.vitDepl : u.vitDepl;
      u.x += (dx / dist) * v * dt;
      u.y += (dy / dist) * v * dt;
      if (u.anim !== 'hit' && u.anim !== 'attack') u.anim = 'walk';
    } else {
      if (u.anim === 'walk') u.anim = 'idle';
      if (u.tAttaque <= 0) attaqueMelee(cs, u, u.cibleIdx);
    }
    ramenerDansArene(u);
  }

  // séparation douce
  for (let i = 0; i < cs.unites.length; i++) {
    const a = cs.unites[i];
    if (!a || !a.vivant) continue;
    for (let j = i + 1; j < cs.unites.length; j++) {
      const b = cs.unites[j];
      if (!b || !b.vivant) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 30) {
        const pousse = ((30 - d) / 2) * 0.5;
        a.x -= (dx / d) * pousse;
        a.y -= (dy / d) * pousse;
        b.x += (dx / d) * pousse;
        b.y += (dy / d) * pousse;
      }
    }
  }

  // projectiles
  for (const p of cs.projectiles) {
    if (!p.vivant) continue;
    const cible = cs.unites[p.cibleIdx];
    if (!cible || !cible.vivant) {
      p.vivant = false;
      continue;
    }
    const dx = cible.x - p.x;
    const dy = cible.y - p.y;
    const d = Math.hypot(dx, dy);
    p.angle = Math.atan2(dy, dx);
    const vitesse = (p.type === 'feu' ? 270 : 330) * BALANCE.TICK;
    if (d < vitesse + 14) {
      p.vivant = false;
      const lanceur = cs.unites[p.lanceurIdx];
      if (!lanceur) continue;
      if (p.type === 'feu') {
        // une boule de feu se voit venir : esquive (réduite de moitié) et blocage au bouclier possibles
        if (cs.rng.chance(Math.min(BALANCE.ESQ_CAP, cible.pEsquive * stanceDef(cs, cible) * 0.5))) {
          cs.evts.push({ type: 'esquive', cibleIdx: p.cibleIdx });
          continue;
        }
        const blocFeu = rouleBloc(cs, p.lanceurIdx, cible, true);
        const degFeu = blocFeu ? p.deg * BALANCE.BLOC_REDUCTION : p.deg;
        cs.evts.push({ type: 'impactProj', x: cible.x, y: cible.y, cibleIdx: p.cibleIdx, deg: Math.round(degFeu), projectile: 'feu' });
        infligerDegats(cs, lanceur, p.cibleIdx, degFeu, true);
      } else {
        // projectile physique : esquive (réduite) puis blocage (renforcé)
        if (rouleEsquive(cs, lanceur, cible, true)) continue;
        const blocage = rouleBloc(cs, p.lanceurIdx, cible, true);
        let deg = p.deg;
        if (blocage) deg *= BALANCE.BLOC_REDUCTION;
        else cs.evts.push({ type: 'impactProj', x: cible.x, y: cible.y, cibleIdx: p.cibleIdx, deg: Math.round(deg), projectile: p.type });
        infligerDegats(cs, lanceur, p.cibleIdx, deg, false);
      }
    } else {
      p.x += (dx / d) * vitesse;
      p.y += (dy / d) * vitesse;
    }
  }
  cs.projectiles = cs.projectiles.filter((p) => p.vivant);

  // fin de combat ?
  const v0 = vivantsDe(cs, 0).length;
  const v1 = vivantsDe(cs, 1).length;
  if (v0 === 0 || v1 === 0 || cs.t >= BALANCE.COMBAT_DUREE_MAX) {
    cs.termine = true;
    if (v0 > 0 && v1 === 0) cs.vainqueur = 0;
    else if (v1 > 0 && v0 === 0) cs.vainqueur = 1;
    else {
      const pv0 = cs.unites.filter((u) => u.equipe === 0).reduce((s, u) => s + u.pv / u.pvMax, 0);
      const pv1 = cs.unites.filter((u) => u.equipe === 1).reduce((s, u) => s + u.pv / u.pvMax, 0);
      if (Math.abs(pv0 - pv1) < 0.24) cs.vainqueur = -1;
      else cs.vainqueur = pv0 > pv1 ? 0 : 1;
    }
    cs.evts.push({ type: 'fin', vainqueur: cs.vainqueur });
  }
}

/** Termine le combat instantanément (bouton « Passer », matchs IA, simu). */
export function simulerJusquAuBout(cs: CombatState): void {
  let garde = 0;
  while (!cs.termine && garde < 200000) {
    tickCombat(cs);
    garde++;
  }
}

export interface ResultatCombat {
  vainqueur: -1 | 0 | 1;
  score: [number, number];
  unites: UniteCombat[];
  duree: number;
}

export function resultatCombat(cs: CombatState): ResultatCombat {
  const elims0 = cs.unites.filter((u) => u.equipe === 1 && !u.vivant).length;
  const elims1 = cs.unites.filter((u) => u.equipe === 0 && !u.vivant).length;
  return { vainqueur: cs.vainqueur, score: [elims0, elims1], unites: cs.unites, duree: cs.t };
}
