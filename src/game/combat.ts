/**
 * Moteur de combat 3 contre 3, vue de dessus.
 * Déterministe (RNG seedé), tourne aussi bien en headless (simulation
 * accélérée, bouton « Passer », simu d'équilibrage) qu'en temps réel animé.
 *
 * Usage des 6 traits (documenté dans EQUILIBRAGE.md) :
 *  - Force        → dégâts mêlée + points de vie
 *  - Vitesse      → vitesse de déplacement + cadence d'attaque
 *  - Intelligence → temps de réaction, choix de cible, garde (réduction de dégâts)
 *  - Fourberie    → chance de critique (renforcée dans le dos de la cible)
 *  - Esquive      → chance d'esquiver une attaque de mêlée
 *  - Magie        → ≥ 60 : lanceur de sorts (boule de feu, nova, soin)
 * Le tout multiplié par l'état (moral, forme, satisfaction salariale).
 */

import { RNG } from '../core/rng';
import type { ClassId, Gladiator } from '../core/types';
import { BALANCE } from '../data/balance';
import { multiplicateurCondition } from './economie';
import { noteGlobale } from './generation';

export type Consigne = 'equilibre' | 'agressif' | 'defensif' | 'magie';

export type AnimId = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'death';

/** Modificateurs d'arme/carrure par classe. */
const MODS_CLASSE: Record<ClassId, { deg: number; pv: number; portee: number }> = {
  colosse: { deg: 1.15, pv: 1.2, portee: 40 },
  bretteur: { deg: 1.0, pv: 1.05, portee: 38 },
  roublard: { deg: 0.92, pv: 0.85, portee: 34 },
  lancier: { deg: 0.95, pv: 0.95, portee: 58 },
  mage: { deg: 0.7, pv: 0.8, portee: 36 },
  berserker: { deg: 1.12, pv: 1.0, portee: 38 },
};

export interface UniteCombat {
  gid: number;
  equipe: 0 | 1;
  nom: string;
  classe: ClassId;
  teinte: number;
  x: number;
  y: number;
  /** direction du regard en radians */
  angle: number;
  pv: number;
  pvMax: number;
  vivant: boolean;
  // attributs dérivés (déjà multipliés par l'état moral/forme/salaire)
  deg: number;
  portee: number;
  cdAttaque: number;
  vitDepl: number;
  pEsquive: number;
  pCrit: number;
  garde: number;
  magie: number;
  intelligence: number;
  fourberie: number;
  estMage: boolean;
  // timers
  tAttaque: number;
  tFeu: number;
  tNova: number;
  tSoin: number;
  tDecision: number;
  tImmobile: number;
  cibleIdx: number;
  // animation (pour le rendu)
  anim: AnimId;
  animT: number;
  // stats du combat
  elims: number;
  degatsInfliges: number;
  soinsRendus: number;
}

export interface Projectile {
  x: number;
  y: number;
  cibleIdx: number;
  deg: number;
  equipe: 0 | 1;
  lanceurIdx: number;
  vivant: boolean;
}

export type EvtCombat =
  | { type: 'coup'; cibleIdx: number; deg: number; crit: boolean }
  | { type: 'esquive'; cibleIdx: number }
  | { type: 'feu'; deIdx: number }
  | { type: 'impactFeu'; x: number; y: number; cibleIdx: number; deg: number }
  | { type: 'nova'; deIdx: number; x: number; y: number; rayon: number }
  | { type: 'soin'; deIdx: number; cibleIdx: number; pv: number }
  | { type: 'mort'; cibleIdx: number; parIdx: number }
  | { type: 'fin'; vainqueur: -1 | 0 | 1 };

export interface CombatState {
  unites: UniteCombat[];
  projectiles: Projectile[];
  /** événements émis pendant le DERNIER tick (drainés par le rendu) */
  evts: EvtCombat[];
  t: number;
  termine: boolean;
  /** -1 = nul */
  vainqueur: -1 | 0 | 1;
  consignes: [Consigne, Consigne];
  /** index d'unité adverse à cibler en priorité (par équipe), -1 = libre */
  focus: [number, number];
  rng: RNG;
}

export const ARENE = { cx: 500, cy: 500, rayon: 392 };

function creerUnite(g: Gladiator, equipe: 0 | 1, idx: number, rng: RNG): UniteCombat {
  // « forme du jour » : variance par combat pour que l'issue ne soit pas écrite d'avance
  const mult = multiplicateurCondition(g) * rng.range(0.92, 1.08);
  const mc = MODS_CLASSE[g.classe];
  const t = g.traits;
  const pvMax = Math.round((BALANCE.PV_BASE + t.force * BALANCE.PV_FORCE + noteGlobale(t, g.classe) * BALANCE.PV_OVR) * mc.pv * (0.9 + 0.1 * mult));
  const positions = [
    { x: -120, y: -110 },
    { x: -160, y: 0 },
    { x: -120, y: 110 },
  ];
  const p = positions[idx % 3] ?? { x: -140, y: 0 };
  const signe = equipe === 0 ? 1 : -1;
  return {
    gid: g.id,
    equipe,
    nom: g.nom,
    classe: g.classe,
    teinte: g.teinte,
    x: ARENE.cx + p.x * signe,
    y: ARENE.cy + p.y,
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
    magie: t.magie,
    intelligence: t.intelligence,
    fourberie: t.fourberie,
    estMage: t.magie >= BALANCE.SEUIL_MAGE,
    tAttaque: 0.6,
    tFeu: 1.2,
    tNova: 5,
    tSoin: 3,
    tDecision: 0,
    tImmobile: 0,
    cibleIdx: -1,
    anim: 'idle',
    animT: 0,
    elims: 0,
    degatsInfliges: 0,
    soinsRendus: 0,
  };
}

export function creerCombat(equipeA: Gladiator[], equipeB: Gladiator[], seed: number): CombatState {
  const rng = new RNG(seed);
  const unites: UniteCombat[] = [];
  equipeA.slice(0, 3).forEach((g, i) => unites.push(creerUnite(g, 0, i, rng)));
  equipeB.slice(0, 3).forEach((g, i) => unites.push(creerUnite(g, 1, i, rng)));
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
    // les futés pondèrent par les PV restants, les brutes foncent sur le plus proche
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

function infligerDegats(cs: CombatState, de: UniteCombat, cibleIdx: number, brut: number, magique: boolean): void {
  const cible = cs.unites[cibleIdx];
  if (!cible || !cible.vivant) return;
  const reduction = Math.min(0.35, cible.garde * stanceDef(cs, cible) * (magique ? 0.5 : 1));
  const deg = Math.max(1, Math.round(brut * (1 - reduction)));
  cible.pv -= deg;
  de.degatsInfliges += deg;
  if (cible.anim !== 'attack' && cible.anim !== 'cast') {
    cible.anim = 'hit';
    cible.animT = 0;
  }
  if (cible.pv <= 0) {
    cible.pv = 0;
    cible.vivant = false;
    cible.anim = 'death';
    cible.animT = 0;
    de.elims += 1;
    cs.evts.push({ type: 'mort', cibleIdx, parIdx: cs.unites.indexOf(de) });
  }
}

function attaqueMelee(cs: CombatState, u: UniteCombat, cibleIdx: number): void {
  const cible = cs.unites[cibleIdx];
  if (!cible || !cible.vivant) return;
  u.tAttaque = u.cdAttaque * cs.rng.range(0.9, 1.1);
  u.anim = 'attack';
  u.animT = 0;
  // esquive (mêlée uniquement)
  const pEsq = Math.min(BALANCE.ESQ_CAP, cible.pEsquive * stanceDef(cs, cible));
  if (cs.rng.chance(pEsq)) {
    cs.evts.push({ type: 'esquive', cibleIdx });
    return;
  }
  // critique : fourberie, renforcée si on frappe dans le dos
  const angVers = Math.atan2(u.y - cible.y, u.x - cible.x);
  let diff = Math.abs(angVers - cible.angle) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  const dansLeDos = diff < Math.PI / 2.5;
  const pCrit = u.pCrit * (dansLeDos ? 1.6 : 1);
  const crit = cs.rng.chance(pCrit);
  const brut = u.deg * stanceDeg(cs, u) * (crit ? BALANCE.CRIT_MULT : 1) * cs.rng.range(0.85, 1.15);
  cs.evts.push({ type: 'coup', cibleIdx, deg: Math.round(brut), crit });
  infligerDegats(cs, u, cibleIdx, brut, false);
}

function lancerSorts(cs: CombatState, u: UniteCombat, uIdx: number, cible: UniteCombat, dist: number): boolean {
  const prioMagie = cs.consignes[u.equipe] === 'magie';
  const facteurCd = prioMagie ? 0.65 : 1;

  // Soin : l'allié le plus amoché sous 60 %
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
  // Nova : ≥ 2 ennemis dans le rayon
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
  // Boule de feu
  if (u.tFeu <= 0 && dist < 340) {
    u.tFeu = BALANCE.FEU_CD * facteurCd;
    u.anim = 'cast';
    u.animT = 0;
    cs.projectiles.push({
      x: u.x + Math.cos(u.angle) * 20,
      y: u.y + Math.sin(u.angle) * 20,
      cibleIdx: cs.unites.indexOf(cible),
      deg: (BALANCE.FEU_BASE + u.magie * BALANCE.FEU_MAGIE) * stanceDeg(cs, u),
      equipe: u.equipe,
      lanceurIdx: uIdx,
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
    u.tFeu -= dt;
    u.tNova -= dt;
    u.tSoin -= dt;
    u.tDecision -= dt;

    // fin d'animation ponctuelle → retour idle
    if ((u.anim === 'attack' || u.anim === 'cast' || u.anim === 'hit') && u.animT > 0.45) {
      u.anim = 'idle';
      u.animT = 0;
    }

    // reconsidérer sa cible : les futés réagissent plus vite
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
          // reculer en gardant la cible en vue
          u.x -= (dx / dist) * u.vitDepl * 0.85 * dt;
          u.y -= (dy / dist) * u.vitDepl * 0.85 * dt;
          u.anim = u.anim === 'hit' ? u.anim : 'walk';
        } else if (dist > distVoulue + 60) {
          u.x += (dx / dist) * u.vitDepl * dt;
          u.y += (dy / dist) * u.vitDepl * dt;
          u.anim = u.anim === 'hit' ? u.anim : 'walk';
        } else if (u.anim === 'walk') {
          u.anim = 'idle';
        }
      }
      ramenerDansArene(u);
      continue;
    }

    // Mêlée : repli défensif si mal en point et arme pas prête
    const defensif = cs.consignes[u.equipe] === 'defensif';
    const replie = defensif && u.pv / u.pvMax < 0.35 && u.tAttaque > 0.4;
    if (replie && dist < 140) {
      u.x -= (dx / dist) * u.vitDepl * 0.8 * dt;
      u.y -= (dy / dist) * u.vitDepl * 0.8 * dt;
      if (u.anim !== 'hit') u.anim = 'walk';
    } else if (dist > u.portee + cible.portee * 0.2) {
      u.x += (dx / dist) * u.vitDepl * dt;
      u.y += (dy / dist) * u.vitDepl * dt;
      if (u.anim !== 'hit' && u.anim !== 'attack') u.anim = 'walk';
    } else {
      if (u.anim === 'walk') u.anim = 'idle';
      if (u.tAttaque <= 0) attaqueMelee(cs, u, u.cibleIdx);
    }
    ramenerDansArene(u);
  }

  // séparation douce des unités empilées
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
    let tx = ARENE.cx;
    let ty = ARENE.cy;
    if (cible && cible.vivant) {
      tx = cible.x;
      ty = cible.y;
    } else {
      p.vivant = false;
      continue;
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    const vitesse = 270 * BALANCE.TICK;
    if (d < vitesse + 14) {
      p.vivant = false;
      const lanceur = cs.unites[p.lanceurIdx];
      cs.evts.push({ type: 'impactFeu', x: tx, y: ty, cibleIdx: p.cibleIdx, deg: Math.round(p.deg) });
      if (lanceur) infligerDegats(cs, lanceur, p.cibleIdx, p.deg, true);
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
      // temps écoulé : décision aux PV restants (nul si très serré)
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
  /** éliminations infligées par chaque équipe (= score type 3-1) */
  score: [number, number];
  unites: UniteCombat[];
  duree: number;
}

export function resultatCombat(cs: CombatState): ResultatCombat {
  const elims0 = cs.unites.filter((u) => u.equipe === 1 && !u.vivant).length;
  const elims1 = cs.unites.filter((u) => u.equipe === 0 && !u.vivant).length;
  return { vainqueur: cs.vainqueur, score: [elims0, elims1], unites: cs.unites, duree: cs.t };
}
