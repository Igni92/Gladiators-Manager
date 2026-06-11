/**
 * Simulation d'équilibrage headless — `npm run sim`
 *
 * Joue plusieurs saisons complètes en accéléré et vérifie :
 *  1. JEU NORMAL (alignements sensés, entraînement, soins, marché raisonnable) :
 *     on ne fait jamais faillite sur 5 saisons et on finit solvable.
 *  2. INACTIF (aucune action, forfaits) : on ne s'enrichit pas sans rien faire.
 * Affiche les métriques utilisées pour calibrer src/data/balance.ts.
 */

import { RNG } from '../../src/core/rng';
import type { GameState, Gladiator, TraitId } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';
import { creerCombat, resultatCombat, simulerJusquAuBout } from '../../src/game/combat';
import { equipeJoueur, marcheOuvert, matchDuJoueur } from '../../src/game/competitions';
import { masseSalariale, multiplicateurCondition } from '../../src/game/economie';
import { nouvellePartie } from '../../src/game/etat';
import { genGladiateur, noteGlobale, salaireExige, valeurTransfert } from '../../src/game/generation';
import { composerEquipeIA } from '../../src/game/ia';
import { accepterOffre, acheterGladiateur } from '../../src/game/marche';
import { enregistrerMatchJoueur, finirSemaine, payerGuerisseur, rngDe, sauverRng } from '../../src/game/moteur';

let echecs = 0;

function verifier(cond: boolean, message: string): void {
  if (!cond) {
    echecs++;
    console.error(`  ❌ ÉCHEC : ${message}`);
  } else {
    console.log(`  ✅ ${message}`);
  }
}

interface Bilan {
  seed: number;
  saisons: number;
  tresorerieFinale: number;
  tresorerieMin: number;
  tresorerieMax: number;
  divisionFinale: number;
  reputation: number;
  victoires: number;
  matchs: number;
  nuls: number;
  gameOver: boolean;
  ovrMoyenFinal: number;
}

/** Joue le match officiel de la semaine avec les 3 meilleurs en forme. */
function jouerMatchSiBesoin(etat: GameState): void {
  const match = matchDuJoueur(etat);
  if (!match || etat.matchJoue) return;
  const joueur = equipeJoueur(etat);
  const dispos = joueur.gladiateurIds
    .map((id) => etat.gladiateurs[id])
    .filter((g): g is Gladiator => !!g && !g.blessure)
    .sort((a, b) => noteGlobale(b.traits, b.classe) * multiplicateurCondition(b) - noteGlobale(a.traits, a.classe) * multiplicateurCondition(a));
  const titulaires = dispos.slice(0, 3);
  if (titulaires.length === 0) return; // forfait géré par finirSemaine
  const adv = etat.equipes[match.adversaireId];
  if (!adv) return;
  const rng = rngDe(etat);
  const cs = creerCombat(titulaires, composerEquipeIA(etat, adv), rng.int(1, 2 ** 31));
  sauverRng(etat, rng);
  simulerJusquAuBout(cs);
  enregistrerMatchJoueur(etat, resultatCombat(cs), match.competition, match.adversaireId, titulaires.map((g) => g.id));
}

/** Gestion « normale » : entraînement, soins, marché prudent. */
function gererSemaineNormale(etat: GameState, rng: RNG): void {
  const joueur = equipeJoueur(etat);

  // entraînement : repos si fatigué, sinon trait principal pour les jeunes (3 max/sem)
  etat.entrainement = {};
  let entraines = 0;
  for (const id of joueur.gladiateurIds) {
    const g = etat.gladiateurs[id];
    if (!g) continue;
    if (g.fatigue > 55) {
      etat.entrainement[id] = 'repos';
    } else if (!g.blessure && g.age <= 27 && joueur.tresorerie > 400 && entraines < 3 && noteGlobale(g.traits, g.classe) < g.potentiel) {
      entraines++;
      const traits: TraitId[] = ['force', 'vitesse', 'intelligence', 'fourberie', 'esquive', 'magie'];
      let meilleur: TraitId = 'force';
      let max = -1;
      for (const t of traits) {
        if (t === 'magie' && g.classe !== 'mage') continue;
        if (g.traits[t] > max) {
          max = g.traits[t];
          meilleur = t;
        }
      }
      etat.entrainement[id] = meilleur;
    }
  }

  // soins si on a de la marge
  for (const id of joueur.gladiateurIds) {
    const g = etat.gladiateurs[id];
    if (g?.blessure && joueur.tresorerie > 400) payerGuerisseur(etat, id);
  }

  if (marcheOuvert(etat.semaine)) {
    // ventes : on accepte les offres généreuses si l'effectif le permet
    for (const offre of [...etat.offresRecues]) {
      const g = etat.gladiateurs[offre.gladiateurId];
      if (!g) continue;
      if (joueur.gladiateurIds.length > 4 && offre.prix >= valeurTransfert(g) * 1.05) {
        accepterOffre(etat, offre);
      }
    }
    // achats : compléter l'effectif à 5 sans se ruiner
    if (joueur.gladiateurIds.length < 5) {
      const abordables = etat.marche
        .map((a) => ({ a, g: etat.gladiateurs[a.gladiateurId] }))
        .filter((x): x is { a: (typeof etat.marche)[0]; g: Gladiator } => !!x.g)
        .filter(({ a, g }) => {
          const coutTotal = a.prixDemande + salaireExige(g) * 12;
          return a.prixDemande <= joueur.tresorerie * 0.45 && coutTotal < joueur.tresorerie * 0.8;
        })
        .sort((x, y) => noteGlobale(y.g.traits, y.g.classe) - noteGlobale(x.g.traits, x.g.classe));
      const choix = abordables[0];
      if (choix) {
        acheterGladiateur(etat, choix.a, choix.a.prixDemande, salaireExige(choix.g));
      }
    }
  }
  void rng;
}

function simuler(seed: number, saisons: number, normale: boolean): Bilan {
  const etat = nouvellePartie(seed, 'Écurie Test');
  const rng = new RNG(seed ^ 0x9e3779b9);
  let tMin = Infinity;
  let tMax = -Infinity;
  const saisonCible = saisons + 1;

  let gardefou = 0;
  while (etat.saison < saisonCible && !etat.gameOver && gardefou < saisons * 40) {
    gardefou++;
    if (normale) {
      jouerMatchSiBesoin(etat);
      gererSemaineNormale(etat, rng);
    }
    finirSemaine(etat);
    const joueur = equipeJoueur(etat);
    tMin = Math.min(tMin, joueur.tresorerie);
    tMax = Math.max(tMax, joueur.tresorerie);
  }

  const joueur = equipeJoueur(etat);
  let victoires = 0;
  let matchs = 0;
  let nuls = 0;
  for (const r of etat.resultats) {
    if (r.competition === 'amical') continue;
    const moi = r.domId === joueur.id ? 0 : r.extId === joueur.id ? 1 : -1;
    if (moi < 0) continue;
    matchs++;
    const pour = moi === 0 ? r.scoreDom : r.scoreExt;
    const contre = moi === 0 ? r.scoreExt : r.scoreDom;
    if (pour > contre) victoires++;
    else if (pour === contre) nuls++;
  }
  const ovrs = joueur.gladiateurIds
    .map((id) => etat.gladiateurs[id])
    .filter((g): g is Gladiator => !!g)
    .map((g) => noteGlobale(g.traits, g.classe));
  return {
    seed,
    saisons: etat.saison - 1,
    tresorerieFinale: Math.round(joueur.tresorerie),
    tresorerieMin: Math.round(tMin),
    tresorerieMax: Math.round(tMax),
    divisionFinale: joueur.division,
    reputation: Math.round(joueur.reputation),
    victoires,
    matchs,
    nuls,
    gameOver: etat.gameOver,
    ovrMoyenFinal: Math.round(ovrs.reduce((a, b) => a + b, 0) / Math.max(1, ovrs.length)),
  };
}

/** Vérifie l'équilibre brut du moteur de combat (le plus fort gagne, mais pas toujours). */
function testerCombat(): void {
  console.log('\n— Moteur de combat —');
  const rng = new RNG(42);

  const duels: [number, number, string][] = [
    [55, 55, 'égaux (55)'],
    [65, 55, '+10 ovr'],
    [75, 55, '+20 ovr'],
  ];
  for (const [ovrA, ovrB, nom] of duels) {
    let vA = 0;
    let nuls = 0;
    let dureeTotale = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const a = [0, 1, 2].map((k) => genGladiateur(rng, 1000 + k, ovrA, -1));
      const b = [0, 1, 2].map((k) => genGladiateur(rng, 2000 + k, ovrB, -1));
      const cs = creerCombat(a, b, rng.int(1, 2 ** 31));
      simulerJusquAuBout(cs);
      const res = resultatCombat(cs);
      if (res.vainqueur === 0) vA++;
      if (res.vainqueur === -1) nuls++;
      dureeTotale += res.duree;
    }
    const pct = Math.round((vA / N) * 100);
    const pctNuls = Math.round((nuls / N) * 100);
    console.log(`  ${nom} : équipe A gagne ${pct} % (nuls ${pctNuls} %), durée moy. ${Math.round(dureeTotale / N)}s`);
    if (ovrA === ovrB) verifier(pct >= 30 && pct <= 70, `duel équilibré ni biaisé ni aléatoire (${pct} %)`);
    if (ovrA - ovrB === 10) verifier(pct >= 60, `+10 ovr doit gagner nettement (${pct} %)`);
    if (ovrA - ovrB === 20) verifier(pct >= 80, `+20 ovr doit dominer (${pct} %)`);
    verifier(pctNuls <= 30, `taux de nuls raisonnable (${pctNuls} %)`);
  }
}

/**
 * DÉTECTION DE MÉTA : cherche une stat dominante, une classe dominante ou une
 * stratégie dégénérée (tout-distance, toujours-agressif, focus systématique…).
 * Échoue si un archétype écrase tous les autres.
 */
function genGladiateurArchetype(rng: RNG, id: number, ovr: number, traitFort: TraitId | null, classe?: import('../../src/core/types').ClassId): Gladiator {
  // essaie jusqu'à obtenir un gladiateur incarnant l'archétype voulu
  for (let essai = 0; essai < 60; essai++) {
    const g = genGladiateur(rng, id, ovr, -1, classe);
    g.talents = [];
    g.talentsConnus = [];
    if (!traitFort) return g;
    // pousse le trait au max en redistribuant depuis les autres (note globale ~constante)
    const traits: TraitId[] = ['force', 'vitesse', 'intelligence', 'fourberie', 'esquive', 'magie'];
    const autres = traits.filter((t) => t !== traitFort && !(t === 'magie' && g.classe !== 'mage'));
    let budget = 0;
    for (const t of autres) {
      const retire = Math.round(g.traits[t] * 0.35);
      g.traits[t] -= retire;
      budget += retire;
    }
    g.traits[traitFort] = Math.min(99, g.traits[traitFort] + Math.round(budget * 0.55));
    if (Math.abs(noteGlobale(g.traits, g.classe) - ovr) <= 6) return g;
  }
  return genGladiateur(rng, id, ovr, -1, classe);
}

function detecterMeta(): void {
  console.log('\n— DÉTECTION DE MÉTA —');
  const rng = new RNG(777);
  const OVR = 62;
  const N = 50;

  // 1) tournoi des stats : équipes spécialisées sur UN trait, round-robin
  const archetypes: { nom: string; trait: TraitId | null }[] = [
    { nom: 'équilibré', trait: null },
    { nom: 'tout-Force', trait: 'force' },
    { nom: 'tout-Vitesse', trait: 'vitesse' },
    { nom: 'tout-Intelligence', trait: 'intelligence' },
    { nom: 'tout-Fourberie', trait: 'fourberie' },
    { nom: 'tout-Esquive', trait: 'esquive' },
  ];
  const scores = new Map<string, number>();
  let totalParArchetype = 0;
  for (let i = 0; i < archetypes.length; i++) {
    for (let j = i + 1; j < archetypes.length; j++) {
      const A = archetypes[i]!;
      const B = archetypes[j]!;
      let vA = 0;
      for (let k = 0; k < N; k++) {
        const ga = [0, 1, 2].map((q) => genGladiateurArchetype(rng, 9000 + q, OVR, A.trait));
        const gb = [0, 1, 2].map((q) => genGladiateurArchetype(rng, 9500 + q, OVR, B.trait));
        const cs = creerCombat(ga, gb, rng.int(1, 2 ** 31));
        simulerJusquAuBout(cs);
        const res = resultatCombat(cs);
        if (res.vainqueur === 0) vA++;
        else if (res.vainqueur === -1) vA += 0.5;
      }
      scores.set(A.nom, (scores.get(A.nom) ?? 0) + vA / N);
      scores.set(B.nom, (scores.get(B.nom) ?? 0) + 1 - vA / N);
    }
    totalParArchetype = archetypes.length - 1;
  }
  for (const a of archetypes) {
    const tauxMoyen = Math.round(((scores.get(a.nom) ?? 0) / totalParArchetype) * 100);
    console.log(`  archétype ${a.nom} : ${tauxMoyen} % de victoires moyennes`);
    if (a.trait === null) {
      // un build équilibré DOIT battre les builds caricaturaux : c'est l'anti-méta par design
      verifier(tauxMoyen >= 60, `le build équilibré reste la valeur sûre (${tauxMoyen} %)`);
    } else {
      // les builds 100 % mono-stat sont volontairement sous-optimaux, mais aucun ne doit écraser (≤ 80)
      verifier(tauxMoyen <= 80, `pas de stat à empiler aveuglément : ${a.nom} ≤ 80 % (${tauxMoyen} %)`);
      verifier(tauxMoyen >= 15, `stat pas totalement morte : ${a.nom} ≥ 15 % (${tauxMoyen} %)`);
    }
  }

  // 1bis) test MARGINAL : +12 dans UNE stat sur un build équilibré → doit aider (>50 %) sans dominer (<75 %)
  console.log('  — gain marginal de +12 par stat —');
  for (const trait of ['force', 'vitesse', 'intelligence', 'fourberie', 'esquive'] as TraitId[]) {
    let v = 0;
    for (let k = 0; k < N; k++) {
      const base = [0, 1, 2].map((q) => genGladiateurArchetype(rng, 9990 + q, OVR, null));
      const boost = base.map((g) => {
        const copie: Gladiator = JSON.parse(JSON.stringify(g));
        copie.traits[trait] = Math.min(99, copie.traits[trait] + 12);
        return copie;
      });
      const cs = creerCombat(boost, base, rng.int(1, 2 ** 31));
      simulerJusquAuBout(cs);
      const res = resultatCombat(cs);
      if (res.vainqueur === 0) v++;
      else if (res.vainqueur === -1) v += 0.5;
    }
    const pct = Math.round((v / N) * 100);
    console.log(`    +12 ${trait} : ${pct} %`);
    verifier(pct >= 50, `+12 ${trait} aide (${pct} % ≥ 50)`);
    verifier(pct <= 78, `+12 ${trait} ne domine pas (${pct} % ≤ 78)`);
  }

  // 2) classes : chaque équipe mono-classe contre un trio varié de référence
  const reference = () => {
    const cls: import('../../src/core/types').ClassId[] = ['bretteur', 'colosse', 'roublard'];
    return cls.map((c, q) => genGladiateurArchetype(rng, 9100 + q, OVR, null, c));
  };
  for (const classe of ['colosse', 'bretteur', 'roublard', 'lancier', 'mage', 'berserker'] as const) {
    let v = 0;
    for (let k = 0; k < N; k++) {
      const mono = [0, 1, 2].map((q) => genGladiateurArchetype(rng, 9200 + q, OVR, null, classe));
      const cs = creerCombat(mono, reference(), rng.int(1, 2 ** 31));
      simulerJusquAuBout(cs);
      const res = resultatCombat(cs);
      if (res.vainqueur === 0) v++;
      else if (res.vainqueur === -1) v += 0.5;
    }
    const pct = Math.round((v / N) * 100);
    console.log(`  trio mono-${classe} vs référence : ${pct} %`);
    verifier(pct <= 72, `pas de classe écrasante : mono-${classe} ≤ 72 % (${pct} %)`);
    verifier(pct >= 22, `pas de classe poubelle : mono-${classe} ≥ 22 % (${pct} %)`);
  }

  // 3) stratégies dégénérées : consigne unique contre consigne équilibrée
  for (const consigne of ['agressif', 'defensif', 'magie'] as const) {
    let v = 0;
    for (let k = 0; k < N; k++) {
      const a = [0, 1, 2].map((q) => genGladiateurArchetype(rng, 9300 + q, OVR, null));
      const b = [0, 1, 2].map((q) => genGladiateurArchetype(rng, 9400 + q, OVR, null));
      const cs = creerCombat(a, b, rng.int(1, 2 ** 31));
      cs.consignes[0] = consigne;
      simulerJusquAuBout(cs);
      const res = resultatCombat(cs);
      if (res.vainqueur === 0) v++;
      else if (res.vainqueur === -1) v += 0.5;
    }
    const pct = Math.round((v / N) * 100);
    console.log(`  consigne « ${consigne} » permanente vs équilibré : ${pct} %`);
    verifier(pct <= 65, `consigne ${consigne} non dégénérée (${pct} %)`);
  }

  // 4) talents : un trio avec 2 talents chacun contre le même trio sans talents
  {
    let v = 0;
    for (let k = 0; k < N; k++) {
      const avec = [0, 1, 2].map((q) => {
        const g = genGladiateurArchetype(rng, 9600 + q, OVR, null);
        g.talents = q === 0 ? ['rage', 'vampirisme'] : q === 1 ? ['fumigene', 'dash'] : ['riposte', 'secondevie'];
        return g;
      });
      const sans = [0, 1, 2].map((q) => genGladiateurArchetype(rng, 9700 + q, OVR, null));
      const cs = creerCombat(avec, sans, rng.int(1, 2 ** 31));
      simulerJusquAuBout(cs);
      const res = resultatCombat(cs);
      if (res.vainqueur === 0) v++;
      else if (res.vainqueur === -1) v += 0.5;
    }
    const pct = Math.round((v / N) * 100);
    console.log(`  trio bardé de talents vs trio sans talents : ${pct} %`);
    // 6 talents synergiques contre zéro = le cas limite absolu (3 gladiateurs doublement
    // talentueux coûtent une fortune) ; ~+4 ovr d'équivalent par talent est le but.
    verifier(pct >= 55 && pct <= 90, `les talents comptent sans tout casser (${pct} %, attendu 55-90)`);
  }

  // 5) placement : la bonne formation (auto) contre tout-le-monde-devant
  {
    let v = 0;
    for (let k = 0; k < N; k++) {
      const cls: import('../../src/core/types').ClassId[] = ['colosse', 'lancier', 'mage'];
      const a = cls.map((c, q) => genGladiateurArchetype(rng, 9800 + q, OVR, null, c));
      const b = cls.map((c, q) => genGladiateurArchetype(rng, 9900 + q, OVR, null, c));
      const cs = creerCombat(a, b, rng.int(1, 2 ** 31), undefined, [0, 3, 6]); // B : tous en première ligne
      simulerJusquAuBout(cs);
      const res = resultatCombat(cs);
      if (res.vainqueur === 0) v++;
      else if (res.vainqueur === -1) v += 0.5;
    }
    const pct = Math.round((v / N) * 100);
    console.log(`  placement réfléchi vs tous-devant : ${pct} %`);
    verifier(pct >= 50, `le placement a un impact positif (${pct} %)`);
  }
}

console.log('=== SIMULATION D’ÉQUILIBRAGE — Gladiators Manager ===');

testerCombat();
detecterMeta();

console.log('\n— Jeu NORMAL (5 saisons × 4 graines) —');
const bilansNormaux: Bilan[] = [];
for (const seed of [11, 222, 3333, 44444]) {
  const b = simuler(seed, 5, true);
  bilansNormaux.push(b);
  console.log(
    `  graine ${b.seed} : ${b.saisons} saisons, division ${b.divisionFinale} (2=bronze), trésorerie fin ${b.tresorerieFinale} [min ${b.tresorerieMin}, max ${b.tresorerieMax}], ` +
      `réput. ${b.reputation}, bilan ${b.victoires}V/${b.nuls}N/${b.matchs - b.victoires - b.nuls}D sur ${b.matchs}, ovr moyen ${b.ovrMoyenFinal}${b.gameOver ? ' — GAME OVER' : ''}`,
  );
}
for (const b of bilansNormaux) {
  verifier(!b.gameOver, `graine ${b.seed} : pas de faillite en jouant normalement`);
  verifier(b.tresorerieFinale > 0, `graine ${b.seed} : solvable après 5 saisons (${b.tresorerieFinale} PO)`);
  verifier(b.victoires / Math.max(1, b.matchs) > 0.3, `graine ${b.seed} : l'écurie gagne des matchs (${Math.round((100 * b.victoires) / Math.max(1, b.matchs))} %)`);
}
verifier(bilansNormaux.some((b) => b.divisionFinale <= 1), 'au moins une écurie monte de division en 5 saisons');

console.log('\n— INACTIF (3 saisons × 3 graines) —');
for (const seed of [5, 666, 7777]) {
  const b = simuler(seed, 3, false);
  console.log(
    `  graine ${b.seed} : trésorerie fin ${b.tresorerieFinale} [min ${b.tresorerieMin}, max ${b.tresorerieMax}]${b.gameOver ? ' — faillite (attendu si on ne joue jamais)' : ''}`,
  );
  verifier(b.tresorerieMax < BALANCE.TRESORERIE_DEPART + 2500, `graine ${b.seed} : ne s'enrichit pas sans jouer (max ${b.tresorerieMax} PO)`);
  verifier(b.tresorerieFinale < BALANCE.TRESORERIE_DEPART, `graine ${b.seed} : l'inactivité coûte de l'argent (fin ${b.tresorerieFinale} PO)`);
}

// sanité économique : la masse salariale de départ est soutenable
{
  const etat = nouvellePartie(99, 'Sanité');
  const joueur = equipeJoueur(etat);
  const masse = masseSalariale(etat, joueur);
  console.log(`\n— Sanité — masse salariale de départ : ${masse} PO/sem, trésorerie ${joueur.tresorerie} PO`);
  verifier(masse < 120, `masse salariale initiale raisonnable (${masse} PO/sem)`);
}

if (echecs > 0) {
  console.error(`\n✗ ${echecs} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\n✓ Équilibrage validé.');
