/**
 * Moteur de jeu hebdomadaire : enregistre les matchs du joueur, simule les
 * matchs IA, applique entraînement / salaires / récupération / marché,
 * fait avancer le calendrier et clôture les saisons.
 */

import { RNG } from '../core/rng';
import type { CompetitionId, GameState, Team } from '../core/types';
import { BALANCE } from '../data/balance';
import { NOMS_DIVISIONS, RUMEURS_AMBIANCE, RUMEURS_MARCHE, TYPES_BLESSURES } from '../data/noms';
import { creerCombat, resultatCombat, simulerJusquAuBout, type ResultatCombat } from './combat';
import {
  SEMAINES_COUPE,
  SEMAINES_INTL,
  SEMAINES_SAISON,
  avancerCoupe,
  classement,
  creerCoupe,
  creerInternational,
  equipeJoueur,
  marcheOuvert,
  matchDuJoueur,
  primeLigue,
} from './competitions';
import { ajouterFinance, clamp, payerSalaires, recuperationHebdo, revenuPassif } from './economie';
import { genGladiateur, genNom, noteGlobale, ovrCibleInternational, palierDeGladiateur } from './generation';
import { composerEquipeIA, gererEquipesIA, meilleureVenteForcee, purgerGladiateursOrphelins } from './ia';
import { genererOffresIA, purgerOffres, regenererMarche } from './marche';
import { NOMS_CLASSES } from '../data/noms';

export function rngDe(etat: GameState): RNG {
  return new RNG(etat.rngState);
}

export function sauverRng(etat: GameState, rng: RNG): void {
  etat.rngState = Math.floor(rng.next() * 4294967296) >>> 0;
}

/** Applique fatigue, blessures éventuelles, moral et stats après un match du joueur. */
function appliquerSequelles(
  etat: GameState,
  rng: RNG,
  res: ResultatCombat,
  equipeCote: 0 | 1,
  victoire: boolean,
  nul: boolean,
  amical: boolean,
  titulaires: number[],
  messages: string[],
): void {
  const joueur = equipeJoueur(etat);
  for (const u of res.unites) {
    if (u.equipe !== equipeCote) continue;
    const g = etat.gladiateurs[u.gid];
    if (!g) continue;
    g.fatigue = clamp(g.fatigue + BALANCE.FATIGUE_COMBAT, 0, 100);
    g.stats.combats++;
    if (victoire) g.stats.victoires++;
    g.stats.elims += u.elims;
    g.stats.degats += Math.round(u.degatsInfliges);
    const ko = !u.vivant;
    let pBlessure = ko ? BALANCE.P_BLESSURE_KO : BALANCE.P_BLESSURE_PARTICIPANT;
    if (amical) pBlessure *= 0.4;
    if (rng.chance(pBlessure)) {
      const semaines = ko ? rng.int(2, 5) : rng.int(1, 2);
      g.blessure = { type: rng.pick(TYPES_BLESSURES), semaines: amical ? Math.max(1, semaines - 1) : semaines };
      messages.push(`🩹 ${g.nom} est blessé : ${g.blessure.type} (${g.blessure.semaines} sem.)`);
    }
    const dMoral = nul ? 1 : victoire ? BALANCE.MORAL_VICTOIRE : BALANCE.MORAL_DEFAITE;
    g.moral = clamp(g.moral + dMoral + BALANCE.MORAL_TITULAIRE, 0, 100);
  }
  // les non-alignés rongent leur frein
  for (const id of joueur.gladiateurIds) {
    if (titulaires.includes(id)) continue;
    const g = etat.gladiateurs[id];
    if (!g || g.blessure) continue;
    let d = BALANCE.MORAL_REMPLACANT;
    if (g.personnalite === 'fier') d -= 2;
    g.moral = clamp(g.moral + d, 0, 100);
  }
}

/**
 * Enregistre le résultat du combat que le joueur vient de disputer
 * (le joueur est TOUJOURS l'équipe 0 du CombatState).
 */
export function enregistrerMatchJoueur(
  etat: GameState,
  res: ResultatCombat,
  competition: CompetitionId,
  adversaireId: number,
  titulaires: number[],
): string[] {
  const messages: string[] = [];
  const rng = rngDe(etat);
  const joueur = equipeJoueur(etat);
  const victoire = res.vainqueur === 0;
  const nul = res.vainqueur === -1;

  etat.resultats.push({
    saison: etat.saison,
    semaine: etat.semaine,
    competition,
    domId: joueur.id,
    extId: adversaireId,
    scoreDom: res.score[0],
    scoreExt: res.score[1],
  });
  etat.matchJoue = true;

  // primes
  if (competition === 'ligue') {
    const prime = primeLigue(joueur.division, victoire ? 'v' : nul ? 'n' : 'd');
    ajouterFinance(etat, `Prime de match (${NOMS_DIVISIONS[joueur.division] ?? 'Ligue'})`, prime);
    const adv = etat.equipes[adversaireId];
    if (adv) adv.tresorerie += primeLigue(adv.division, victoire ? 'd' : nul ? 'n' : 'v');
    joueur.reputation = clamp(
      joueur.reputation + (victoire ? (BALANCE.REPUT_VICTOIRE_LIGUE[joueur.division] ?? 0.3) : nul ? 0.1 : BALANCE.REPUT_DEFAITE),
      0,
      100,
    );
  } else if (competition === 'coupe' && etat.coupe) {
    if (victoire) {
      const prime = BALANCE.primesCoupe[etat.coupe.tourActuel] ?? 0;
      ajouterFinance(etat, `Prime de Coupe (tour ${etat.coupe.tourActuel + 1})`, prime);
      joueur.reputation = clamp(joueur.reputation + BALANCE.REPUT_COUPE_TOUR, 0, 100);
      if (etat.coupe.tourActuel === etat.coupe.tours.length - 1) {
        ajouterFinance(etat, '🏆 VAINQUEUR DE LA COUPE DU ROYAUME', BALANCE.BONUS_VAINQUEUR_COUPE);
        joueur.reputation = clamp(joueur.reputation + BALANCE.REPUT_TITRE_COUPE, 0, 100);
        messages.push('🏆 Votre écurie remporte la Coupe du Royaume !');
      }
    }
  } else if (competition === 'international' && etat.international) {
    if (victoire) {
      const prime = BALANCE.primesInternational[etat.international.tourActuel] ?? 0;
      ajouterFinance(etat, `Prime du Tournoi des Champions`, prime);
      joueur.reputation = clamp(joueur.reputation + 2.5, 0, 100);
      if (etat.international.tourActuel === etat.international.tours.length - 1) {
        ajouterFinance(etat, '🏆 CHAMPION INTERNATIONAL', BALANCE.BONUS_VAINQUEUR_INTL);
        joueur.reputation = clamp(joueur.reputation + BALANCE.REPUT_TITRE_INTL, 0, 100);
        messages.push('🌍 LÉGENDAIRE ! Votre écurie est championne du monde !');
      }
    }
  } else if (competition === 'amical') {
    ajouterFinance(etat, 'Recette du match amical', victoire ? BALANCE.PRIME_AMICAL_V : BALANCE.PRIME_AMICAL_D);
  }

  appliquerSequelles(etat, rng, res, 0, victoire, nul, competition === 'amical', titulaires, messages);
  sauverRng(etat, rng);
  return messages;
}

/** Simule un match IA contre IA (headless) et enregistre le résultat. */
function simulerMatchIA(etat: GameState, rng: RNG, domId: number, extId: number, competition: CompetitionId): { domId: number; extId: number; scoreDom: number; scoreExt: number } {
  const dom = etat.equipes[domId];
  const ext = etat.equipes[extId];
  const gDom = dom ? composerEquipeIA(etat, dom) : [];
  const gExt = ext ? composerEquipeIA(etat, ext) : [];
  let scoreDom: number;
  let scoreExt: number;
  if (gDom.length === 0 || gExt.length === 0) {
    scoreDom = gDom.length === 0 ? 0 : 3;
    scoreExt = gExt.length === 0 ? 0 : 3;
  } else {
    const cs = creerCombat(gDom, gExt, rng.int(1, 2 ** 31));
    simulerJusquAuBout(cs);
    const res = resultatCombat(cs);
    scoreDom = res.score[0];
    scoreExt = res.score[1];
    if (res.vainqueur === -1 && competition !== 'ligue') {
      // pas de nul en élimination directe : départage aux PV restants puis pile ou face
      if (scoreDom === scoreExt) scoreDom += rng.chance(0.5) ? 1 : 0;
      if (scoreDom === scoreExt) scoreExt += 1;
    }
    // fatigue et blessures pour les IA aussi (symétrie avec le joueur)
    for (const u of cs.unites) {
      const g = etat.gladiateurs[u.gid];
      if (!g) continue;
      g.fatigue = clamp(g.fatigue + 14, 0, 100);
      const pBlessure = u.vivant ? BALANCE.P_BLESSURE_PARTICIPANT : BALANCE.P_BLESSURE_KO;
      if (rng.chance(pBlessure)) {
        g.blessure = { type: rng.pick(TYPES_BLESSURES), semaines: u.vivant ? rng.int(1, 2) : rng.int(2, 5) };
      }
    }
  }
  etat.resultats.push({ saison: etat.saison, semaine: etat.semaine, competition, domId, extId, scoreDom, scoreExt });
  if (competition === 'ligue' && dom && ext) {
    dom.tresorerie += primeLigue(dom.division, scoreDom > scoreExt ? 'v' : scoreDom === scoreExt ? 'n' : 'd');
    ext.tresorerie += primeLigue(ext.division, scoreExt > scoreDom ? 'v' : scoreDom === scoreExt ? 'n' : 'd');
  }
  return { domId, extId, scoreDom, scoreExt };
}

/** Vainqueur d'un match de coupe déjà enregistré cette semaine. */
function vainqueurEnregistre(etat: GameState, a: number, b: number): number {
  for (let i = etat.resultats.length - 1; i >= 0; i--) {
    const r = etat.resultats[i];
    if (!r || r.saison !== etat.saison || r.semaine !== etat.semaine) break;
    if ((r.domId === a && r.extId === b) || (r.domId === b && r.extId === a)) {
      if (r.scoreDom === r.scoreExt) return a; // ne devrait pas arriver en coupe
      const gagnantDom = r.scoreDom > r.scoreExt;
      return gagnantDom ? r.domId : r.extId;
    }
  }
  return -1;
}

/** Applique les choix d'entraînement de la semaine. */
function appliquerEntrainement(etat: GameState, rng: RNG, messages: string[]): void {
  const joueur = equipeJoueur(etat);
  for (const id of joueur.gladiateurIds) {
    const g = etat.gladiateurs[id];
    if (!g) continue;
    const choix = etat.entrainement[id];
    if (!choix) continue;
    if (choix === 'repos') {
      g.fatigue = clamp(g.fatigue - BALANCE.RECUP_REPOS, 0, 100);
      g.moral = clamp(g.moral + 1, 0, 100);
      continue;
    }
    if (g.blessure) continue;
    const ovr = noteGlobale(g.traits, g.classe);
    const cout = Math.round(BALANCE.COUT_ENTR_BASE + ovr * BALANCE.COUT_ENTR_PENTE);
    if (joueur.tresorerie < cout) continue;
    ajouterFinance(etat, `Entraînement : ${g.nom}`, -cout);
    g.fatigue = clamp(g.fatigue + BALANCE.FATIGUE_ENTRAINEMENT, 0, 100);
    if (ovr >= g.potentiel) continue; // plafond atteint : on entretient sans progresser
    const fAge = g.age <= 21 ? 1.4 : g.age <= 25 ? 1.1 : g.age <= 29 ? 0.75 : 0.35;
    const gain = BALANCE.GAIN_ENTR_BASE * fAge;
    // gain fractionnaire → probabilité de +1 (ou +2 si gain > 1)
    let pts = Math.floor(gain);
    if (rng.chance(gain - pts)) pts++;
    if (pts > 0 && g.traits[choix] < 99) {
      g.traits[choix] = Math.min(99, g.traits[choix] + pts);
      const nouvOvr = noteGlobale(g.traits, g.classe);
      if (nouvOvr > ovr) messages.push(`📈 ${g.nom} progresse (${ovr} → ${nouvOvr})`);
    }
  }
}

/** Régénère les rumeurs de la taverne. */
function regenererRumeurs(etat: GameState, rng: RNG): void {
  etat.rumeurs = [];
  const annonces = rng.shuffle([...etat.marche]).slice(0, 2);
  for (const a of annonces) {
    const g = etat.gladiateurs[a.gladiateurId];
    if (!g) continue;
    const modele = rng.pick(RUMEURS_MARCHE);
    etat.rumeurs.push({
      texte: modele
        .replace('{nom}', g.nom)
        .replace('{palier}', palierDeGladiateur(g))
        .replace('{classe}', NOMS_CLASSES[g.classe]),
      gladiateurId: g.id,
    });
  }
  etat.rumeurs.push({ texte: rng.pick(RUMEURS_AMBIANCE), gladiateurId: -1 });
}

/** Vieillissement, déclin et retraites de fin de saison. */
function vieillissement(etat: GameState, rng: RNG, messages: string[]): void {
  const joueur = equipeJoueur(etat);
  for (const eq of etat.equipes) {
    const retraites: number[] = [];
    for (const id of [...eq.gladiateurIds]) {
      const g = etat.gladiateurs[id];
      if (!g) continue;
      g.age++;
      if (g.age >= 30) {
        for (const t of ['force', 'vitesse', 'esquive'] as const) {
          g.traits[t] = Math.max(5, Math.round(g.traits[t] - BALANCE.DECLIN_ANNUEL * rng.range(0.6, 1.4)));
        }
      }
      const ovr = noteGlobale(g.traits, g.classe);
      if (g.age >= BALANCE.AGE_RETRAITE || (g.age >= 33 && ovr < 42)) {
        retraites.push(id);
        if (eq.estJoueur) messages.push(`👋 ${g.nom} (${g.age} ans) raccroche ses armes.`);
      }
    }
    eq.gladiateurIds = eq.gladiateurIds.filter((id) => !retraites.includes(id));
    for (const id of retraites) delete etat.gladiateurs[id];
  }
  // effectif joueur trop maigre après retraites → un jeune du cru rejoint gratuitement
  if (joueur.gladiateurIds.length < 3) {
    const g = genGladiateur(rng, etat.prochainId++, rng.int(42, 50), joueur.id);
    g.age = rng.int(17, 20);
    g.nom = genNom(rng);
    etat.gladiateurs[g.id] = g;
    joueur.gladiateurIds.push(g.id);
    messages.push(`🌱 Un jeune espoir rejoint l'écurie : ${g.nom}`);
  }
}

/** Clôture de saison : prix, montées/descentes, vieillissement, nouvelle saison. */
function cloturerSaison(etat: GameState, rng: RNG, messages: string[]): void {
  // prix de fin de saison + titres
  for (const ligue of etat.ligues) {
    const cl = classement(etat, ligue);
    cl.forEach((ligne, rang) => {
      const prix = BALANCE.prixSaison[ligue.division]?.[rang] ?? 0;
      const eq = etat.equipes[ligne.equipeId];
      if (!eq) return;
      if (eq.estJoueur) {
        ajouterFinance(etat, `Prix de fin de saison (${rang + 1}ᵉ de ${NOMS_DIVISIONS[ligue.division]})`, prix);
        if (rang === 0) {
          eq.reputation = clamp(eq.reputation + (BALANCE.REPUT_TITRE_LIGUE[ligue.division] ?? 3), 0, 100);
          messages.push(`🏆 CHAMPIONS de ${NOMS_DIVISIONS[ligue.division]} !`);
        }
      } else {
        eq.tresorerie += prix;
        if (rang === 0) eq.reputation = clamp(eq.reputation + (BALANCE.REPUT_TITRE_LIGUE[ligue.division] ?? 3), 0, 100);
      }
    });
  }

  // montées / descentes (top 2 / bottom 2)
  const mouvements: { equipeId: number; vers: number }[] = [];
  for (const ligue of etat.ligues) {
    const cl = classement(etat, ligue);
    if (ligue.division < 2) {
      for (const ligne of cl.slice(-2)) mouvements.push({ equipeId: ligne.equipeId, vers: ligue.division + 1 });
    }
    if (ligue.division > 0) {
      for (const ligne of cl.slice(0, 2)) mouvements.push({ equipeId: ligne.equipeId, vers: ligue.division - 1 });
    }
  }
  for (const m of mouvements) {
    const eq = etat.equipes[m.equipeId];
    if (!eq) continue;
    if (eq.estJoueur) {
      messages.push(m.vers < eq.division ? `⬆️ PROMOTION en ${NOMS_DIVISIONS[m.vers]} !` : `⬇️ Relégation en ${NOMS_DIVISIONS[m.vers]}…`);
    }
    eq.division = m.vers;
  }

  vieillissement(etat, rng, messages);
  purgerGladiateursOrphelins(etat);

  etat.saison++;
  messages.push(`📜 La saison ${etat.saison} commence. Fenêtre de transfert ouverte !`);
  demarrerSaison(etat, rng);
  regenererMarche(etat, rng);
  regenererRumeurs(etat, rng);
}

/** Gestion de la dette : départs forcés si la caisse reste vide trop longtemps. */
function gererDette(etat: GameState, messages: string[]): void {
  const joueur = equipeJoueur(etat);
  if (joueur.tresorerie >= 0) {
    joueur.semainesDettes = 0;
    return;
  }
  joueur.semainesDettes++;
  if (joueur.semainesDettes === 2) {
    messages.push('⚠️ Trésorerie négative ! Vendez ou réduisez la masse salariale, sinon vos gladiateurs partiront.');
  }
  if (joueur.semainesDettes >= BALANCE.SEMAINES_DETTE_MAX) {
    const vente = meilleureVenteForcee(etat, joueur);
    if (vente) {
      ajouterFinance(etat, `Vente forcée : ${vente.g.nom}`, vente.prix);
      joueur.gladiateurIds = joueur.gladiateurIds.filter((id) => id !== vente.g.id);
      delete etat.gladiateurs[vente.g.id];
      messages.push(`💸 Faute de paye, ${vente.g.nom} est parti (vente forcée, ${vente.prix} PO).`);
      joueur.semainesDettes = 2;
    }
    if (joueur.gladiateurIds.length < 3 && joueur.tresorerie < -500) {
      etat.gameOver = true;
      messages.push('☠️ L’écurie est en faillite. Fin de partie.');
    }
  }
}

import { demarrerSaison } from './etat';

/**
 * Termine la semaine : matchs IA, forfait éventuel du joueur, entraînement,
 * paie, récupération, marché, avancée du calendrier.
 * Renvoie les messages à afficher au joueur.
 */
export function finirSemaine(etat: GameState): string[] {
  if (etat.gameOver) return [];
  const messages: string[] = [];
  const rng = rngDe(etat);
  const joueur = equipeJoueur(etat);

  // 1) forfait si le joueur n'a pas disputé son match officiel
  const match = matchDuJoueur(etat);
  if (match && !etat.matchJoue) {
    etat.resultats.push({
      saison: etat.saison,
      semaine: etat.semaine,
      competition: match.competition,
      domId: joueur.id,
      extId: match.adversaireId,
      scoreDom: 0,
      scoreExt: 3,
    });
    etat.matchJoue = true;
    joueur.reputation = clamp(joueur.reputation - 1.5, 0, 100);
    for (const id of joueur.gladiateurIds) {
      const g = etat.gladiateurs[id];
      if (g) g.moral = clamp(g.moral - 5, 0, 100);
    }
    messages.push('🚫 Forfait ! Votre équipe ne s’est pas présentée (défaite 0-3).');
  }

  // 2) journée de ligue : matchs IA des 3 divisions
  for (const ligue of etat.ligues) {
    const journee = ligue.journees.find((j) => j.semaine === etat.semaine && !j.joue);
    if (!journee) continue;
    for (const [a, b] of journee.matchs) {
      if (a === joueur.id || b === joueur.id) continue; // déjà enregistré (ou forfait ci-dessus)
      simulerMatchIA(etat, rng, a, b, 'ligue');
    }
    journee.joue = true;
  }

  // 3) tour de coupe / international
  for (const coupe of [etat.coupe, etat.international]) {
    if (!coupe || coupe.termine) continue;
    const tour = coupe.tours[coupe.tourActuel];
    if (!tour || tour.semaine !== etat.semaine || tour.joue) continue;
    const vainqueurs: number[] = [];
    for (const [a, b] of tour.matchs) {
      if (a === joueur.id || b === joueur.id) {
        const v = vainqueurEnregistre(etat, a, b);
        vainqueurs.push(v >= 0 ? v : a === joueur.id ? b : a);
      } else {
        const r = simulerMatchIA(etat, rng, a, b, coupe.competition);
        vainqueurs.push(r.scoreDom > r.scoreExt ? r.domId : r.extId);
      }
    }
    avancerCoupe(coupe, vainqueurs);
    if (coupe.termine) {
      const champion = etat.equipes[coupe.qualifies[0] ?? -1];
      if (champion && !champion.estJoueur) {
        messages.push(`🏆 ${champion.nom} remporte ${coupe.nom === 'Coupe du Royaume' ? 'la' : 'le'} ${coupe.nom}.`);
        if (coupe.competition === 'coupe') champion.tresorerie += BALANCE.BONUS_VAINQUEUR_COUPE;
      }
    }
  }

  // 4) entraînement, paie, récupération
  appliquerEntrainement(etat, rng, messages);
  payerSalaires(etat);
  revenuPassif(etat);
  recuperationHebdo(etat);

  // 5) marché et IA
  if (marcheOuvert(etat.semaine)) {
    genererOffresIA(etat, rng);
  }
  purgerOffres(etat);
  gererEquipesIA(etat, rng);
  regenererRumeurs(etat, rng);
  gererDette(etat, messages);

  // 6) avancée du calendrier
  etat.semaine++;
  etat.matchJoue = false;
  if (etat.semaine > SEMAINES_SAISON) {
    cloturerSaison(etat, rng, messages);
  } else {
    // événements d'entrée de semaine
    if (etat.semaine === SEMAINES_COUPE[0] && !etat.coupe) {
      etat.coupe = creerCoupe(etat, rng);
      const dedans = etat.coupe.qualifies.includes(joueur.id);
      messages.push(dedans ? '⚔️ Vous êtes qualifié pour la Coupe du Royaume !' : 'La Coupe du Royaume commence (sans vous cette saison).');
    }
    if (etat.semaine === SEMAINES_INTL[0] && !etat.international) {
      if (joueur.reputation >= BALANCE.REPUTATION_INTL) {
        // équipes étrangères d'élite (recréées/rafraîchies à chaque participation)
        const etrangers = etat.equipes.filter((e) => e.division === -1);
        for (const e of etrangers) {
          // effectif régénéré au niveau élite
          for (const id of e.gladiateurIds) delete etat.gladiateurs[id];
          e.gladiateurIds = [];
          for (let i = 0; i < 4; i++) {
            const g = genGladiateur(rng, etat.prochainId++, ovrCibleInternational(rng), e.id);
            etat.gladiateurs[g.id] = g;
            e.gladiateurIds.push(g.id);
          }
        }
        etat.international = creerInternational([joueur.id, ...etat.equipes.filter((e) => e.division === -1).map((e) => e.id)].slice(0, 8), rng);
        messages.push('🌍 Votre réputation vous ouvre le Tournoi des Champions !');
      } else if (!etat.flags['intlRefuse' + etat.saison]) {
        etat.flags['intlRefuse' + etat.saison] = true;
        messages.push(`🌍 Le Tournoi des Champions se joue sans vous (réputation ${Math.round(joueur.reputation)}/${BALANCE.REPUTATION_INTL}).`);
      }
    }
    if (etat.semaine === 17 || etat.semaine === 27) {
      regenererMarche(etat, rng);
      messages.push('🛒 La fenêtre de transfert est ouverte !');
    }
  }

  etat.historiqueTresorerie.push(Math.round(joueur.tresorerie));
  if (etat.historiqueTresorerie.length > 240) etat.historiqueTresorerie.splice(0, etat.historiqueTresorerie.length - 240);
  sauverRng(etat, rng);
  return messages;
}

/** Soigne une semaine de blessure contre paiement (infirmerie). */
export function payerGuerisseur(etat: GameState, gladiateurId: number): boolean {
  const joueur = equipeJoueur(etat);
  const g = etat.gladiateurs[gladiateurId];
  if (!g || !g.blessure || joueur.tresorerie < BALANCE.COUT_GUERISSEUR) return false;
  ajouterFinance(etat, `Guérisseur : ${g.nom}`, -BALANCE.COUT_GUERISSEUR);
  g.blessure.semaines--;
  if (g.blessure.semaines <= 0) g.blessure = null;
  return true;
}

/** Renégocie le salaire d'un gladiateur du joueur (hausse immédiate, moral +). */
export function changerSalaire(etat: GameState, gladiateurId: number, nouveau: number): void {
  const g = etat.gladiateurs[gladiateurId];
  if (!g) return;
  const ancien = g.salaire;
  g.salaire = Math.max(1, Math.round(nouveau));
  if (g.salaire > ancien) g.moral = clamp(g.moral + 4, 0, 100);
  else if (g.salaire < ancien) g.moral = clamp(g.moral - 8, 0, 100);
}

/** Adversaire d'amical : une équipe de la même division (ou n'importe laquelle). */
export function adversaireAmical(etat: GameState, rng: RNG): Team {
  const joueur = equipeJoueur(etat);
  const memeDiv = etat.equipes.filter((e) => !e.estJoueur && e.division === joueur.division);
  const pool = memeDiv.length > 0 ? memeDiv : etat.equipes.filter((e) => !e.estJoueur && e.division >= 0);
  return rng.pick(pool);
}
