/** Écran ville : hub interactif (canvas) + barre d'état + fin de semaine. */

import { equipeJoueur, libelleSemaine, marcheOuvert, matchDuJoueur } from '../../game/competitions';
import { finirSemaine } from '../../game/moteur';
import { SceneVille } from '../../render/ville';
import { el, fmtPO, icone, modale, toasts } from '../dom';
import { jeu, type Ecran } from '../jeu';
import { ouvrirAide, ouvrirTuto } from '../tuto';

let scene: SceneVille | null = null;

export function rendreVille(): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';
  scene?.arreter();

  const joueur = equipeJoueur(etat);
  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-ville' });

  // barre du haut
  const haut = el(
    'div',
    { class: 'ville-haut' },
    el('div', { class: 'pastille', 'data-testid': 'tresorerie' }, icone('po', 16), ' ', fmtPO(joueur.tresorerie)),
    el('div', { class: 'pastille' }, `📅 S${etat.saison} · sem. ${etat.semaine}/30`),
    el('div', { class: 'pastille' }, icone('reputation', 16), ` ${Math.round(joueur.reputation)}`),
    el(
      'button',
      { class: 'pastille', 'data-testid': 'btn-equipe', onclick: () => jeu.aller('equipe'), style: 'margin-left:auto;' },
      `🛡️ Équipe (${joueur.gladiateurIds.length})`,
    ),
    el('button', { class: 'pastille', 'data-testid': 'btn-monde', onclick: () => jeu.aller('monde') }, '🗺️'),
    el('button', { class: 'pastille', 'data-testid': 'btn-tuto', onclick: () => ouvrirTuto() }, icone('aide', 16)),
  );

  // canvas ville
  const wrap = el('div', { class: 'ville-canvas-wrap' });
  const canvas = el('canvas', { class: 'plein', 'data-testid': 'canvas-ville' });
  wrap.append(canvas);

  // barre du bas : semaine + action principale
  const match = matchDuJoueur(etat);
  const bas = el('div', { class: 'ville-bas' });
  const info = el('div', { class: 'info-semaine' });
  info.append(el('div', null, libelleSemaine(etat, etat.semaine)));
  if (match && !etat.matchJoue) {
    const adv = etat.equipes[match.adversaireId];
    info.append(el('div', null, el('span', { class: 'badge-alerte' }, `⚔️ Match contre ${adv?.nom ?? '???'}`)));
  } else if (marcheOuvert(etat.semaine)) {
    info.append(el('div', { class: 'texte-faible' }, '🛒 Marché des transferts ouvert'));
  }
  bas.append(info);

  if (match && !etat.matchJoue) {
    bas.append(
      el('button', { class: 'btn principal', 'data-testid': 'btn-jouer-match', onclick: () => jeu.aller('match') }, '⚔️ Jouer'),
    );
  }
  bas.append(
    el(
      'button',
      {
        class: `btn ${match && !etat.matchJoue ? '' : 'principal'}`,
        'data-testid': 'btn-semaine-suivante',
        onclick: () => {
          if (match && !etat.matchJoue) {
            confirmationForfait(() => avancer());
          } else {
            avancer();
          }
        },
      },
      '⏭️ Semaine suiv.',
    ),
  );

  ecran.append(haut, wrap, bas);
  racine.append(ecran);

  scene = new SceneVille(canvas);
  scene.surBatiment = (b) => {
    jeu.aller(b.ecran as Ecran);
  };
  scene.demarrer();

  if (etat.gameOver) {
    afficherGameOver();
  } else if (!etat.flags['tutoVu']) {
    etat.flags['tutoVu'] = true;
    jeu.sauver();
    ouvrirTuto();
  }
  void ouvrirAide;
}

function avancer(): void {
  const etat = jeu.etat;
  if (!etat) return;
  const messages = finirSemaine(etat);
  jeu.sauver();
  jeu.aller('ville');
  toasts(messages);
}

function confirmationForfait(continuer: () => void): void {
  const contenu = el(
    'div',
    null,
    el('h2', { style: 'color:var(--or-clair);font-size:18px;margin-bottom:10px;' }, 'Match non joué !'),
    el('p', { style: 'font-size:14px;line-height:1.45;margin-bottom:14px;' },
      'Si vous passez la semaine sans combattre, votre équipe déclarera forfait (défaite 0-3, réputation en baisse).'),
    el('button', { class: 'btn principal large', onclick: () => { fermer(); jeu.aller('match'); } }, '⚔️ Jouer le match'),
    el('div', { class: 'sep' }),
    el('button', { class: 'btn danger large', onclick: () => { fermer(); continuer(); } }, 'Déclarer forfait'),
  );
  const fermer = modale(contenu);
}

function afficherGameOver(): void {
  const contenu = el(
    'div',
    { class: 'centre' },
    el('h2', { style: 'color:var(--rouge);font-size:24px;margin-bottom:10px;' }, '☠️ Faillite'),
    el('p', { style: 'font-size:14px;line-height:1.5;margin-bottom:14px;' },
      'Les dettes ont eu raison de votre écurie. Les gladiateurs sont partis, l’arène vous oublie déjà…'),
    el('button', {
      class: 'btn principal large',
      onclick: () => {
        fermer();
        jeu.etat = null;
        jeu.aller('titre');
      },
    }, 'Retour au titre'),
  );
  const fermer = modale(contenu, { fermable: false });
}
