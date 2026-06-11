/** Création de partie et mise en place d'une saison. */

import { RNG } from '../core/rng';
import type { GameState, Team } from '../core/types';
import { BALANCE } from '../data/balance';
import { COULEURS_EQUIPES, NOMS_EQUIPES, RUMEURS_AMBIANCE } from '../data/noms';
import { genererCalendrierLigue } from './competitions';
import { genGladiateur, ovrCibleDivision } from './generation';
import { regenererMarche } from './marche';

export const VERSION_SAVE = 3;

function creerEquipeIA(etat: GameState, rng: RNG, nom: string, couleur: string, division: number): Team {
  const eq: Team = {
    id: etat.equipes.length,
    nom,
    couleur,
    tresorerie: rng.int(800, 2500),
    reputation: division === 0 ? rng.int(55, 75) : division === 1 ? rng.int(30, 50) : rng.int(10, 30),
    gladiateurIds: [],
    estJoueur: false,
    division,
    semainesDettes: 0,
  };
  etat.equipes.push(eq);
  const taille = rng.int(4, 5);
  for (let i = 0; i < taille; i++) {
    const g = genGladiateur(rng, etat.prochainId++, ovrCibleDivision(rng, division), eq.id);
    etat.gladiateurs[g.id] = g;
    eq.gladiateurIds.push(g.id);
  }
  return eq;
}

/** Crée une nouvelle partie : 24 équipes (3 divisions de 8), le joueur démarre en Ligue de Bronze. */
export function nouvellePartie(seed: number, nomEcurie: string): GameState {
  const rng = new RNG(seed);
  const etat: GameState = {
    version: VERSION_SAVE,
    seed,
    rngState: seed,
    saison: 1,
    semaine: 1,
    equipeJoueurId: 0,
    equipes: [],
    gladiateurs: {},
    prochainId: 1,
    ligues: [],
    coupe: null,
    international: null,
    resultats: [],
    marche: [],
    offresRecues: [],
    prochainOffreId: 1,
    rumeurs: [],
    finances: [],
    entrainement: {},
    matchJoue: false,
    historiqueTresorerie: [],
    placements: {},
    flags: {},
    gameOver: false,
  };

  // équipe du joueur (id 0), en D3
  const joueur: Team = {
    id: 0,
    nom: nomEcurie || 'Écurie du Lion',
    couleur: '#d4a017',
    tresorerie: BALANCE.TRESORERIE_DEPART,
    reputation: 12,
    gladiateurIds: [],
    estJoueur: true,
    division: 2,
    semainesDettes: 0,
  };
  etat.equipes.push(joueur);
  // effectif de départ : 5 combattants modestes mais variés (jamais de mage : ça se mérite)
  const classesDepart = ['bretteur', 'colosse', 'roublard', 'lancier', 'berserker'] as const;
  for (const classe of classesDepart) {
    const g = genGladiateur(rng, etat.prochainId++, rng.int(48, 56), 0, classe);
    g.salaire = Math.max(5, g.salaire);
    etat.gladiateurs[g.id] = g;
    joueur.gladiateurIds.push(g.id);
  }

  // 23 équipes IA : 8 en D1, 8 en D2, 7 en D3 (le joueur complète)
  const noms = rng.shuffle([...NOMS_EQUIPES]);
  const couleurs = rng.shuffle([...COULEURS_EQUIPES]);
  let n = 0;
  for (const division of [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]) {
    creerEquipeIA(etat, rng, noms[n % noms.length] ?? `Écurie ${n}`, couleurs[n % couleurs.length] ?? '#888', division);
    n++;
  }

  demarrerSaison(etat, rng);
  // la fenêtre de transfert de pré-saison est ouverte dès la semaine 1
  regenererMarche(etat, rng);
  etat.rumeurs.push({ texte: rng.pick(RUMEURS_AMBIANCE), gladiateurId: -1 });
  const annonce = etat.marche[0];
  if (annonce) {
    const g = etat.gladiateurs[annonce.gladiateurId];
    if (g) etat.rumeurs.unshift({ texte: `Un marchand jure que ${g.nom} cherche une nouvelle écurie.`, gladiateurId: g.id });
  }
  etat.rngState = Math.floor(rng.next() * 4294967296);
  etat.historiqueTresorerie.push(joueur.tresorerie);
  return etat;
}

/** (Re)construit les calendriers de ligue pour la saison courante. */
export function demarrerSaison(etat: GameState, rng: RNG): void {
  etat.ligues = [];
  for (let division = 0; division < 3; division++) {
    const equipes = etat.equipes.filter((e) => e.division === division).map((e) => e.id);
    etat.ligues.push({ division, equipes, journees: genererCalendrierLigue(equipes, rng) });
  }
  etat.coupe = null;
  etat.international = null;
  etat.semaine = 1;
  etat.matchJoue = false;
  etat.entrainement = {};
}
