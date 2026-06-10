/** Économie : salaires, satisfaction, moral, finances, condition de combat. */

import type { GameState, Gladiator, Team } from '../core/types';
import { BALANCE } from '../data/balance';
import { noteGlobale, salaireExige } from './generation';

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Satisfaction salariale 0.5..1.5 (1 = payé exactement ce qu'il exige). */
export function satisfaction(g: Gladiator): number {
  const exige = salaireExige(g);
  return clamp(g.salaire / Math.max(1, exige), 0.5, 1.5);
}

/**
 * Multiplicateur de performance en combat :
 * salaire ×(0.92 + 0.10×satisfaction), moral ×(0.90 + 0.20×moral/100),
 * forme ×(0.92 + 0.10×forme/100). Documenté dans EQUILIBRAGE.md.
 */
export function multiplicateurCondition(g: Gladiator): number {
  const s = satisfaction(g);
  const mSal = BALANCE.PERF_SAL_BASE + BALANCE.PERF_SAL_PENTE * s;
  const mMoral = 0.9 + 0.2 * (g.moral / 100);
  const mForme = 0.92 + 0.1 * (g.forme / 100);
  return mSal * mMoral * mForme;
}

export function ajouterFinance(etat: GameState, libelle: string, montant: number): void {
  const joueur = etat.equipes[etat.equipeJoueurId];
  if (!joueur) return;
  joueur.tresorerie += montant;
  etat.finances.push({ saison: etat.saison, semaine: etat.semaine, libelle, montant });
  if (etat.finances.length > 400) etat.finances.splice(0, etat.finances.length - 400);
}

/** Masse salariale hebdomadaire d'une équipe. */
export function masseSalariale(etat: GameState, equipe: Team): number {
  let total = 0;
  for (const id of equipe.gladiateurIds) {
    const g = etat.gladiateurs[id];
    if (g) total += g.salaire;
  }
  return total;
}

/** Paie hebdo + dérive de moral liée à la satisfaction salariale. */
export function payerSalaires(etat: GameState): void {
  const joueur = etat.equipes[etat.equipeJoueurId];
  if (!joueur) return;
  const total = masseSalariale(etat, joueur);
  if (total > 0) ajouterFinance(etat, 'Salaires', -total);

  const impayes = joueur.tresorerie < 0;
  for (const id of joueur.gladiateurIds) {
    const g = etat.gladiateurs[id];
    if (!g) continue;
    const s = satisfaction(g);
    let derive = clamp((s - 1) * BALANCE.MORAL_SAL_PENTE, -BALANCE.MORAL_SAL_MAX, BALANCE.MORAL_SAL_MAX);
    if (g.personnalite === 'cupide') derive *= 1.6;
    if (g.personnalite === 'fidele') derive *= 0.6;
    if (impayes) derive -= 6; // caisse vide : tout le monde gronde
    // inertie : retour doux vers 50
    const inertie = (50 - g.moral) * BALANCE.MORAL_INERTIE;
    let bonusPerso = 0;
    if (g.personnalite === 'jovial') bonusPerso = 0.8;
    g.moral = clamp(g.moral + derive + inertie + bonusPerso, 0, 100);
  }
}

/** Revenu passif hebdo (échoppes, paris, badauds) indexé sur la réputation. */
export function revenuPassif(etat: GameState): void {
  const joueur = etat.equipes[etat.equipeJoueurId];
  if (!joueur) return;
  const montant = Math.round(BALANCE.REVENU_PASSIF_BASE + BALANCE.REVENU_PASSIF_REPUT * joueur.reputation);
  ajouterFinance(etat, 'Recettes de l’écurie', montant);
}

/** Récupération hebdo : fatigue baisse, forme converge vers (100 - fatigue), blessures guérissent. */
export function recuperationHebdo(etat: GameState): void {
  for (const idStr of Object.keys(etat.gladiateurs)) {
    const g = etat.gladiateurs[Number(idStr)];
    if (!g) continue;
    g.fatigue = clamp(g.fatigue - BALANCE.RECUP_PASSIVE, 0, 100);
    const cible = 100 - g.fatigue;
    g.forme = clamp(g.forme + (cible - g.forme) * 0.45, 0, 100);
    if (g.blessure) {
      g.blessure.semaines -= 1;
      if (g.blessure.semaines <= 0) g.blessure = null;
    }
  }
}

/** Note d'équipe = moyenne des 3 meilleures notes globales (pour l'IA et l'affichage). */
export function forceEquipe(etat: GameState, equipe: Team): number {
  const notes = equipe.gladiateurIds
    .map((id) => {
      const g = etat.gladiateurs[id];
      return g ? noteGlobale(g.traits, g.classe) : 0;
    })
    .sort((a, b) => b - a);
  const top = notes.slice(0, 3);
  if (top.length === 0) return 0;
  return Math.round(top.reduce((a, b) => a + b, 0) / top.length);
}
