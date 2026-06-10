/** IA des écuries adverses : composition, gestion d'effectif, achats au marché. */

import { RNG } from '../core/rng';
import type { GameState, Gladiator, Team } from '../core/types';
import { genGladiateur, noteGlobale, ovrCibleDivision, salaireAttendu, valeurTransfert } from './generation';
import { multiplicateurCondition } from './economie';

/** Les 3 meilleurs gladiateurs disponibles (sains), pondérés par leur état. */
export function composerEquipeIA(etat: GameState, equipe: Team): Gladiator[] {
  const dispos = equipe.gladiateurIds
    .map((id) => etat.gladiateurs[id])
    .filter((g): g is Gladiator => !!g && !g.blessure)
    .sort((a, b) => noteGlobale(b.traits, b.classe) * multiplicateurCondition(b) - noteGlobale(a.traits, a.classe) * multiplicateurCondition(a));
  return dispos.slice(0, 3);
}

/**
 * Gestion hebdo des écuries IA, volontairement légère :
 * revenus/salaires forfaitaires, effectif maintenu à 4+ têtes, soins gratuits
 * accélérés (les IA n'ont pas d'écran infirmerie).
 */
export function gererEquipesIA(etat: GameState, rng: RNG): void {
  for (const eq of etat.equipes) {
    if (eq.estJoueur || eq.division < 0) continue;
    // micro-économie : revenu de division - masse salariale simplifiée
    const revenus = [620, 290, 150][eq.division] ?? 150;
    let salaires = 0;
    for (const id of eq.gladiateurIds) {
      const g = etat.gladiateurs[id];
      if (g) salaires += g.salaire;
    }
    eq.tresorerie += revenus - salaires;

    // le moral des IA dérive vers une valeur moyenne (le joueur, lui, gère le sien)
    for (const id of eq.gladiateurIds) {
      const g = etat.gladiateurs[id];
      if (g) g.moral = Math.max(0, Math.min(100, g.moral + (55 - g.moral) * 0.25 + rng.range(-2, 2)));
    }

    // effectif trop maigre → recrue du cru
    while (eq.gladiateurIds.length < 4) {
      const g = genGladiateur(rng, etat.prochainId++, ovrCibleDivision(rng, eq.division) - rng.int(0, 4), eq.id);
      etat.gladiateurs[g.id] = g;
      eq.gladiateurIds.push(g.id);
    }

    // l'IA pioche parfois dans le marché si elle est riche (fenêtre ouverte gérée par l'appelant)
    if (eq.tresorerie > 2500 && rng.chance(0.08) && etat.marche.length > 3) {
      const annonce = rng.pick(etat.marche);
      const g = etat.gladiateurs[annonce.gladiateurId];
      const plafondOvr = [78, 68, 58][eq.division] ?? 58;
      if (g && annonce.vendeurId === -1 && annonce.prixDemande < eq.tresorerie * 0.5 && noteGlobale(g.traits, g.classe) <= plafondOvr) {
        eq.tresorerie -= annonce.prixDemande;
        g.equipeId = eq.id;
        g.salaire = salaireAttendu(noteGlobale(g.traits, g.classe));
        eq.gladiateurIds.push(g.id);
        etat.marche = etat.marche.filter((a) => a.gladiateurId !== g.id);
      }
    }
  }
}

/** Supprime du monde les gladiateurs IA sans équipe et hors marché (anti-bloat). */
export function purgerGladiateursOrphelins(etat: GameState): void {
  const utilises = new Set<number>();
  for (const eq of etat.equipes) for (const id of eq.gladiateurIds) utilises.add(id);
  for (const a of etat.marche) utilises.add(a.gladiateurId);
  for (const idStr of Object.keys(etat.gladiateurs)) {
    const id = Number(idStr);
    if (!utilises.has(id)) delete etat.gladiateurs[id];
  }
}

/** Valeur indicative pour les ventes forcées (dette prolongée du joueur). */
export function meilleureVenteForcee(etat: GameState, equipe: Team): { g: Gladiator; prix: number } | null {
  const gs = equipe.gladiateurIds
    .map((id) => etat.gladiateurs[id])
    .filter((g): g is Gladiator => !!g)
    .sort((a, b) => valeurTransfert(b) - valeurTransfert(a));
  const g = gs[0];
  if (!g) return null;
  return { g, prix: Math.round((valeurTransfert(g) * 0.8) / 10) * 10 };
}
