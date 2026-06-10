/**
 * Marché des transferts — ouvert uniquement ENTRE les compétitions
 * (pré-saison S1-S2, mi-saison S17-S18, intersaison S27-S30).
 *  - Annonces : agents libres générés + gladiateurs mis en vente par les IA.
 *  - Achat : négociation prix (vers le vendeur) + salaire (vers le gladiateur).
 *  - Vente : les IA font des offres spontanées sur vos gladiateurs,
 *    relançables (elles ont un budget max caché).
 */

import { RNG } from '../core/rng';
import type { AnnonceMarche, GameState, Gladiator, OffreRecue } from '../core/types';
import { BALANCE } from '../data/balance';
import { ajouterFinance } from './economie';
import { genGladiateur, noteGlobale, ovrCibleDivision, salaireAttendu, salaireExige, valeurTransfert } from './generation';
import { equipeJoueur } from './competitions';

/** Regénère le vivier d'annonces à l'ouverture d'une fenêtre. */
export function regenererMarche(etat: GameState, rng: RNG): void {
  etat.marche = [];
  const joueur = equipeJoueur(etat);

  // 1) gladiateurs d'équipes IA mis en vente (surplus d'effectif ou besoin d'argent)
  const candidats: Gladiator[] = [];
  for (const eq of etat.equipes) {
    if (eq.estJoueur || eq.division < 0) continue;
    if (eq.gladiateurIds.length <= 4) continue;
    const gs = eq.gladiateurIds
      .map((id) => etat.gladiateurs[id])
      .filter((g): g is Gladiator => !!g)
      .sort((a, b) => noteGlobale(a.traits, a.classe) - noteGlobale(b.traits, b.classe));
    // l'IA vend ses moins bons éléments, parfois un bon si caisses vides
    if (gs.length > 0 && rng.chance(0.6)) candidats.push(gs[0] as Gladiator);
    if (eq.tresorerie < 200 && gs.length > 1 && rng.chance(0.5)) candidats.push(gs[gs.length - 1] as Gladiator);
  }
  rng.shuffle(candidats);
  for (const g of candidats.slice(0, 4)) {
    etat.marche.push({
      gladiateurId: g.id,
      prixDemande: Math.round((valeurTransfert(g) * rng.range(0.95, 1.25)) / 10) * 10,
      vendeurId: g.equipeId,
      tentatives: 0,
    });
  }

  // 2) agents libres : niveau centré sur la division du joueur (avec quelques pépites)
  while (etat.marche.length < BALANCE.TAILLE_MARCHE) {
    let cible = ovrCibleDivision(rng, joueur.division);
    if (rng.chance(0.15)) cible = Math.min(94, cible + rng.int(8, 16)); // pépite chère
    const g = genGladiateur(rng, etat.prochainId++, cible, -1);
    etat.gladiateurs[g.id] = g;
    etat.marche.push({
      gladiateurId: g.id,
      prixDemande: Math.round((valeurTransfert(g) * rng.range(0.85, 1.1)) / 10) * 10,
      vendeurId: -1,
      tentatives: 0,
    });
  }
}

export type ReponseVendeur =
  | { type: 'accepte' }
  | { type: 'contre'; prix: number }
  | { type: 'refuse' };

/** Le vendeur évalue une offre de prix du joueur. */
export function reponseVendeur(annonce: AnnonceMarche, prixOffert: number, rng: RNG): ReponseVendeur {
  const seuil = annonce.prixDemande * 0.92;
  if (prixOffert >= seuil) return { type: 'accepte' };
  if (prixOffert >= annonce.prixDemande * 0.7 && annonce.tentatives < 3) {
    // contre-proposition : on coupe la poire en deux, légèrement à son avantage
    const contre = Math.round(((annonce.prixDemande + prixOffert) / 2 + annonce.prixDemande * rng.range(0, 0.06)) / 10) * 10;
    return { type: 'contre', prix: Math.min(annonce.prixDemande, contre) };
  }
  return { type: 'refuse' };
}

export type ReponseGladiateur = { type: 'accepte' } | { type: 'exige'; salaire: number };

/** Le gladiateur évalue le salaire proposé. */
export function reponseGladiateur(g: Gladiator, salaireOffert: number): ReponseGladiateur {
  const exige = salaireExige(g);
  if (salaireOffert >= Math.round(exige * 0.95)) return { type: 'accepte' };
  return { type: 'exige', salaire: exige };
}

/** Finalise un achat (le prix ET le salaire ont été acceptés). */
export function acheterGladiateur(etat: GameState, annonce: AnnonceMarche, prix: number, salaire: number): void {
  const g = etat.gladiateurs[annonce.gladiateurId];
  if (!g) return;
  const joueur = equipeJoueur(etat);
  ajouterFinance(etat, `Transfert : ${g.nom}`, -prix);
  if (annonce.vendeurId >= 0) {
    const vendeur = etat.equipes[annonce.vendeurId];
    if (vendeur) {
      vendeur.tresorerie += prix;
      vendeur.gladiateurIds = vendeur.gladiateurIds.filter((id) => id !== g.id);
    }
  }
  g.equipeId = joueur.id;
  g.salaire = salaire;
  g.moral = Math.min(100, g.moral + 10); // l'arrivée motive
  joueur.gladiateurIds.push(g.id);
  etat.marche = etat.marche.filter((a) => a.gladiateurId !== g.id);
}

/** Les IA font des offres spontanées sur les gladiateurs du joueur (fenêtre ouverte). */
export function genererOffresIA(etat: GameState, rng: RNG): void {
  const joueur = equipeJoueur(etat);
  if (!rng.chance(BALANCE.P_OFFRE_IA)) return;
  const cibles = joueur.gladiateurIds
    .map((id) => etat.gladiateurs[id])
    .filter((g): g is Gladiator => !!g && !etat.offresRecues.some((o) => o.gladiateurId === g.id));
  if (cibles.length === 0) return;
  // les IA convoitent plutôt vos meilleurs éléments
  cibles.sort((a, b) => noteGlobale(b.traits, b.classe) - noteGlobale(a.traits, a.classe));
  const g = rng.chance(0.6) ? (cibles[0] as Gladiator) : rng.pick(cibles);
  const acheteurs = etat.equipes.filter((e) => !e.estJoueur && e.division >= 0 && e.tresorerie > valeurTransfert(g) * 0.6);
  if (acheteurs.length === 0) return;
  const acheteur = rng.pick(acheteurs);
  const valeur = valeurTransfert(g);
  const max = Math.round(valeur * rng.range(0.95, BALANCE.OFFRE_IA_MAX + 0.15));
  const prix = Math.round((valeur * rng.range(BALANCE.OFFRE_IA_MIN, 1.05)) / 10) * 10;
  etat.offresRecues.push({
    id: etat.prochainOffreId++,
    gladiateurId: g.id,
    equipeId: acheteur.id,
    prix: Math.min(prix, max),
    expire: etat.semaine + 2,
    relances: 0,
    maxCache: max,
  });
}

export type ReponseRelance = { type: 'monte'; prix: number } | { type: 'retire' };

/** Le joueur relance : l'IA monte si son budget caché le permet, sinon elle se retire. */
export function relancerOffre(offre: OffreRecue, rng: RNG): ReponseRelance {
  offre.relances++;
  if (offre.relances > 2 || offre.prix >= offre.maxCache * 0.98) return { type: 'retire' };
  const nouveau = Math.min(offre.maxCache, Math.round((offre.prix * rng.range(1.1, 1.22)) / 10) * 10);
  if (nouveau <= offre.prix) return { type: 'retire' };
  offre.prix = nouveau;
  return { type: 'monte', prix: nouveau };
}

/** Accepte une offre IA : vend le gladiateur. */
export function accepterOffre(etat: GameState, offre: OffreRecue): void {
  const g = etat.gladiateurs[offre.gladiateurId];
  const joueur = equipeJoueur(etat);
  const acheteur = etat.equipes[offre.equipeId];
  if (!g || !acheteur) return;
  ajouterFinance(etat, `Vente : ${g.nom}`, offre.prix);
  acheteur.tresorerie -= offre.prix;
  joueur.gladiateurIds = joueur.gladiateurIds.filter((id) => id !== g.id);
  acheteur.gladiateurIds.push(g.id);
  g.equipeId = acheteur.id;
  g.salaire = salaireAttendu(noteGlobale(g.traits, g.classe));
  etat.offresRecues = etat.offresRecues.filter((o) => o.id !== offre.id);
  // le vestiaire n'aime pas voir partir un des siens
  for (const id of joueur.gladiateurIds) {
    const reste = etat.gladiateurs[id];
    if (reste) reste.moral = Math.max(0, reste.moral - 3);
  }
}

export function refuserOffre(etat: GameState, offre: OffreRecue): void {
  etat.offresRecues = etat.offresRecues.filter((o) => o.id !== offre.id);
}

/** Purge des offres expirées (appelé chaque semaine). */
export function purgerOffres(etat: GameState): void {
  etat.offresRecues = etat.offresRecues.filter((o) => o.expire >= etat.semaine);
}
