/** Tutoriel de première partie + aide contextuelle par écran. */

import { AIDE_CLASSES, AIDE_ECRANS, AIDE_TRAITS } from '../data/aide';
import { ICONES_RACES, RACES, RACE_IDS } from '../data/races';
import { TALENTS } from '../data/talents';
import { NOMS_CLASSES } from '../data/noms';
import type { ClassId, TraitId } from '../core/types';
import { el, icone, modale } from './dom';
import { ICONES_CLASSES } from './composants';

interface EtapeTuto {
  titre: string;
  ico: string;
  lignes: string[];
}

const ETAPES: EtapeTuto[] = [
  {
    titre: 'Bienvenue, manager !',
    ico: 'reputation',
    lignes: [
      'Vous dirigez une écurie de gladiateurs mercenaires en Ligue de Bronze.',
      'Recrutez, entraînez, payez vos combattants — et menez-les jusqu’au Tournoi des Champions.',
      'Une partie se joue sur plusieurs saisons de 30 semaines, sauvegardée automatiquement.',
    ],
  },
  {
    titre: 'La ville est votre QG',
    ico: 'po',
    lignes: [
      'Touchez les bâtiments : Arène (matchs), Marché (transferts), Caserne (entraînement), Taverne (rumeurs), Banque (finances), Infirmerie (soins).',
      '« Semaine suiv. » fait avancer le temps : salaires payés, entraînements appliqués, matchs des rivaux joués.',
      'Un match qui vous attend doit être joué AVANT de finir la semaine, sinon forfait !',
    ],
  },
  {
    titre: 'Les cartes et les paliers',
    ico: 'talent',
    lignes: [
      'Chaque gladiateur a une RACE (humain, elfe, nain, orc, gobelin, drakéide — chacune avec ses points forts), 6 traits sur 100 et une note globale qui définit son palier : D, C, B, A, S, SS.',
      'Force = mêlée et PV · Vitesse = cadence · Intelligence = blocage et garde · Fourberie = critiques et tirs à distance · Esquive = évite les coups · Magie = sorts (à 60+).',
      'Les talents CACHÉS (jusqu’à 2) se découvrent quand ils se déclenchent dans vos matchs.',
    ],
  },
  {
    titre: 'Le combat : placez, puis regardez',
    ico: 'riposte',
    lignes: [
      'Avant chaque combat, placez vos 3 titulaires sur la grille : cogneurs DEVANT, tireurs au CENTRE, mages DERRIÈRE.',
      'Le combat se joue tout seul ; donnez des consignes en direct (agressif/défensif/magie), touchez un ennemi pour le cibler, ou « Passer ».',
      'Les projectiles (couteaux, javelots) se BLOQUENT bien plus facilement que les coups au corps à corps : l’Intelligence protège vos arrières.',
    ],
  },
  {
    titre: 'L’argent est le nerf de l’arène',
    ico: 'bourse',
    lignes: [
      'Un gladiateur sous-payé pour son palier perd du moral et combat moins bien. Bien payé : léger bonus.',
      'Le marché n’ouvre qu’ENTRE les compétitions (S1-2, S17-18, S27-30). Négociez prix ET salaire.',
      'La Taverne affiche vos chances de voir apparaître des recrues de haut palier — votre réputation les améliore.',
      'Bonne chance, manager. La foule attend du sang et du spectacle !',
    ],
  },
];

/** Tutoriel séquencé (première partie, ou via le bouton ? de la ville). */
export function ouvrirTuto(surFin?: () => void): void {
  let etape = 0;
  const contenu = el('div', { class: 'tuto', 'data-testid': 'tuto' });
  const rendre = () => {
    const e = ETAPES[etape];
    if (!e) return;
    contenu.innerHTML = '';
    const points = el('div', { class: 'tuto-points' });
    ETAPES.forEach((_, i) => points.append(el('span', { class: `tuto-point ${i === etape ? 'actif' : ''}` })));
    contenu.append(
      el('div', { class: 'centre' }, icone(e.ico, 64)),
      el('h2', { style: 'color:var(--or-clair);text-align:center;font-size:20px;margin:8px 0 10px;' }, e.titre),
      ...e.lignes.map((l) => el('p', { style: 'font-size:14px;line-height:1.5;margin-bottom:8px;' }, l)),
      points,
      el('div', { style: 'display:flex;gap:8px;margin-top:12px;' },
        etape > 0 ? el('button', { class: 'btn', style: 'flex:1;', onclick: () => { etape--; rendre(); } }, '‹ Précédent') : null,
        el('button', {
          class: 'btn principal', style: 'flex:2;', 'data-testid': 'tuto-suivant',
          onclick: () => {
            if (etape < ETAPES.length - 1) {
              etape++;
              rendre();
            } else {
              fermer();
              surFin?.();
            }
          },
        }, etape < ETAPES.length - 1 ? 'Suivant ›' : '⚔️ À l’arène !'),
      ),
    );
  };
  const fermer = modale(contenu, { fermable: false });
  rendre();
}

/** Aide contextuelle d'un écran (bouton ? de l'en-tête). */
export function ouvrirAide(ecranId: string): void {
  const aide = AIDE_ECRANS[ecranId];
  if (!aide) return;
  const contenu = el('div', null, el('h2', { style: 'color:var(--or-clair);font-size:19px;margin-bottom:10px;' }, `💡 ${aide.titre}`));
  for (const t of aide.texte) contenu.append(el('p', { style: 'font-size:13.5px;line-height:1.5;margin-bottom:8px;' }, t));

  // compléments selon l'écran
  if (ecranId === 'equipe' || ecranId === 'match') {
    contenu.append(el('h2', { style: 'color:var(--or-clair);font-size:15px;margin:10px 0 6px;' }, 'Les 6 traits'));
    for (const t of Object.keys(AIDE_TRAITS) as TraitId[]) {
      contenu.append(
        el('div', { class: 'ligne-liste', style: 'font-size:12.5px;align-items:flex-start;' },
          icone(t, 22),
          el('div', { style: 'flex:1;' }, el('b', null, AIDE_TRAITS[t].titre, ' : '), AIDE_TRAITS[t].texte)),
      );
    }
  }
  if (ecranId === 'equipe') {
    contenu.append(el('h2', { style: 'color:var(--or-clair);font-size:15px;margin:10px 0 6px;' }, 'Les races'));
    for (const r of RACE_IDS) {
      contenu.append(
        el('div', { class: 'ligne-liste', style: 'font-size:12.5px;align-items:flex-start;' },
          el('span', { style: 'width:24px;text-align:center;' }, ICONES_RACES[r]),
          el('div', { style: 'flex:1;' }, el('b', null, RACES[r].nom, ' : '), RACES[r].description)),
      );
    }
    contenu.append(el('h2', { style: 'color:var(--or-clair);font-size:15px;margin:10px 0 6px;' }, 'Les classes'));
    for (const c of Object.keys(AIDE_CLASSES) as ClassId[]) {
      contenu.append(
        el('div', { class: 'ligne-liste', style: 'font-size:12.5px;align-items:flex-start;' },
          el('span', { style: 'width:24px;text-align:center;' }, ICONES_CLASSES[c] ?? ''),
          el('div', { style: 'flex:1;' }, el('b', null, NOMS_CLASSES[c], ' : '), AIDE_CLASSES[c])),
      );
    }
    contenu.append(el('h2', { style: 'color:var(--or-clair);font-size:15px;margin:10px 0 6px;' }, 'Codex des talents cachés'));
    for (const t of Object.values(TALENTS)) {
      contenu.append(
        el('div', { class: 'ligne-liste', style: 'font-size:12.5px;align-items:flex-start;' },
          icone(t.id, 22),
          el('div', { style: 'flex:1;' }, el('b', null, t.nom, ' : '), t.description)),
      );
    }
  }
  contenu.append(el('div', { class: 'sep' }));
  const fermer = modale(contenu);
  contenu.append(el('button', { class: 'btn principal large', onclick: () => fermer() }, 'Compris !'));
}
