/** Écran arène : prochain match, classements, calendrier, coupes, historique. */

import type { CoupeState, MatchResult } from '../../core/types';
import { classement, equipeJoueur, libelleSemaine, matchDuJoueur, SEMAINES_SAISON } from '../../game/competitions';
import { forceEquipe } from '../../game/economie';
import { NOMS_DIVISIONS } from '../../data/noms';
import { enTete } from '../composants';
import { el } from '../dom';
import { jeu } from '../jeu';

type Onglet = 'match' | 'classement' | 'calendrier' | 'coupes' | 'historique';
let ongletActif: Onglet = 'match';

export function rendreArene(): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-arene' });
  ecran.append(enTete('Arène', () => jeu.aller('ville'), 'arene'));

  const onglets: { id: Onglet; nom: string }[] = [
    { id: 'match', nom: 'Match' },
    { id: 'classement', nom: 'Classement' },
    { id: 'calendrier', nom: 'Calendrier' },
    { id: 'coupes', nom: 'Coupes' },
    { id: 'historique', nom: 'Résultats' },
  ];
  const barre = el('div', { class: 'onglets' });
  for (const o of onglets) {
    barre.append(
      el(
        'button',
        {
          class: `onglet ${o.id === ongletActif ? 'actif' : ''}`,
          'data-testid': `onglet-${o.id}`,
          onclick: () => {
            ongletActif = o.id;
            rendreArene();
          },
        },
        o.nom,
      ),
    );
  }
  ecran.append(barre);

  const contenu = el('div', { class: 'contenu' });
  switch (ongletActif) {
    case 'match':
      contenu.append(...vueMatch());
      break;
    case 'classement':
      contenu.append(...vueClassement());
      break;
    case 'calendrier':
      contenu.append(...vueCalendrier());
      break;
    case 'coupes':
      contenu.append(...vueCoupes());
      break;
    case 'historique':
      contenu.append(...vueHistorique());
      break;
  }
  ecran.append(contenu);
  racine.append(ecran);
}

function vueMatch(): HTMLElement[] {
  const etat = jeu.etat!;
  const joueur = equipeJoueur(etat);
  const sortie: HTMLElement[] = [];
  const match = matchDuJoueur(etat);

  sortie.push(
    el(
      'div',
      { class: 'panneau centre' },
      el('h2', null, `Semaine ${etat.semaine} — saison ${etat.saison}`),
      el('div', null, libelleSemaine(etat, etat.semaine)),
    ),
  );

  if (match && !etat.matchJoue) {
    const adv = etat.equipes[match.adversaireId];
    sortie.push(
      el(
        'div',
        { class: 'panneau centre' },
        el('h2', null, '⚔️ Votre prochain combat'),
        el('div', { style: 'font-size:18px;font-weight:800;margin:8px 0;' }, `${joueur.nom}`, el('div', { class: 'texte-faible' }, 'contre'), `${adv?.nom ?? '???'}`),
        el('div', { class: 'texte-faible', style: 'margin-bottom:10px;' }, `Force adverse estimée : ${adv ? forceEquipe(etat, adv) : '?'} · la vôtre : ${forceEquipe(etat, joueur)}`),
        el('button', { class: 'btn principal large', 'data-testid': 'btn-jouer', onclick: () => jeu.aller('match') }, '🏟️ Préparer le combat'),
      ),
    );
  } else if (etat.matchJoue) {
    sortie.push(el('div', { class: 'panneau centre' }, '✅ Combat de la semaine disputé. Passez à la semaine suivante depuis la ville.'));
  } else {
    sortie.push(
      el(
        'div',
        { class: 'panneau centre' },
        el('div', { style: 'margin-bottom:10px;' }, 'Pas de match officiel cette semaine.'),
        el('button', { class: 'btn large', 'data-testid': 'btn-amical', onclick: () => jeu.aller('match', { amical: true }) }, '🤝 Organiser un amical'),
        el('div', { class: 'texte-faible', style: 'margin-top:8px;' }, 'Sans enjeu : idéal pour tester vos recrues (risque de blessure réduit).'),
      ),
    );
  }
  return sortie;
}

function vueClassement(): HTMLElement[] {
  const etat = jeu.etat!;
  const joueur = equipeJoueur(etat);
  const sortie: HTMLElement[] = [];
  for (const ligue of etat.ligues) {
    const estMaLigue = ligue.equipes.includes(joueur.id);
    const panneau = el('div', { class: 'panneau' }, el('h2', null, `${NOMS_DIVISIONS[ligue.division]} ${estMaLigue ? '· votre ligue' : ''}`));
    const table = el('table', { class: 'classement' });
    table.append(
      el('tr', null, el('th', null, '#'), el('th', { style: 'text-align:left' }, 'Écurie'), el('th', null, 'J'), el('th', null, 'G'), el('th', null, 'N'), el('th', null, 'P'), el('th', null, '+/-'), el('th', null, 'Pts')),
    );
    classement(etat, ligue).forEach((l, i) => {
      const eq = etat.equipes[l.equipeId];
      const tr = el(
        'tr',
        { class: eq?.estJoueur ? 'joueur' : '' },
        el('td', null, String(i + 1)),
        el('td', { class: 'eq' }, el('span', { class: 'pastille-couleur', style: `background:${eq?.couleur ?? '#888'}` }), eq?.nom ?? '?'),
        el('td', null, String(l.j)),
        el('td', null, String(l.g)),
        el('td', null, String(l.n)),
        el('td', null, String(l.p)),
        el('td', null, String(l.plus - l.moins)),
        el('td', null, el('b', null, String(l.pts))),
      );
      table.append(tr);
    });
    panneau.append(table);
    if (estMaLigue) sortie.unshift(panneau);
    else sortie.push(panneau);
  }
  sortie.push(
    el('div', { class: 'panneau texte-faible' }, 'Fin de saison : les 2 premiers montent, les 2 derniers descendent. Les 8 écuries de la Ligue d’Or et les 4 premières des autres divisions disputent la Coupe du Royaume.'),
  );
  return sortie;
}

function vueCalendrier(): HTMLElement[] {
  const etat = jeu.etat!;
  const panneau = el('div', { class: 'panneau' }, el('h2', null, `Calendrier — saison ${etat.saison}`));
  for (let s = 1; s <= SEMAINES_SAISON; s++) {
    const actuel = s === etat.semaine;
    panneau.append(
      el(
        'div',
        { class: 'ligne-liste', style: actuel ? 'background:rgba(212,160,23,.15);border-radius:8px;' : s < etat.semaine ? 'opacity:.45;' : '' },
        el('div', { style: 'width:52px;font-weight:800;color:var(--or-clair);' }, `S${s}`),
        el('div', { style: 'flex:1;font-size:13.5px;' }, libelleSemaine(etat, s)),
        actuel ? el('span', { class: 'badge-alerte' }, 'ICI') : null,
      ),
    );
  }
  return [panneau];
}

function vueCoupe(coupe: CoupeState): HTMLElement {
  const etat = jeu.etat!;
  const panneau = el('div', { class: 'panneau' }, el('h2', null, `🏆 ${coupe.nom}`));
  const nomsTours = coupe.tours.length === 4 ? ['8es de finale', 'Quarts', 'Demi-finales', 'Finale'] : ['Quarts', 'Demi-finales', 'Finale'];
  coupe.tours.forEach((tour, ti) => {
    panneau.append(el('div', { style: 'font-weight:800;color:var(--or-clair);margin:8px 0 4px;font-size:13px;' }, `${nomsTours[ti]} — semaine ${tour.semaine}`));
    if (tour.matchs.length === 0) {
      panneau.append(el('div', { class: 'texte-faible', style: 'padding:4px 8px;' }, 'À déterminer…'));
      return;
    }
    for (const [a, b] of tour.matchs) {
      const res = etat.resultats.find(
        (r) => r.saison === etat.saison && r.competition === coupe.competition && ((r.domId === a && r.extId === b) || (r.domId === b && r.extId === a)),
      );
      const eqA = etat.equipes[a];
      const eqB = etat.equipes[b];
      const score = res ? (res.domId === a ? `${res.scoreDom} - ${res.scoreExt}` : `${res.scoreExt} - ${res.scoreDom}`) : 'vs';
      panneau.append(
        el(
          'div',
          { class: 'ligne-liste', style: 'font-size:13px;' },
          el('div', { style: `flex:1;text-align:right;${eqA?.estJoueur ? 'color:var(--or-clair);font-weight:800;' : ''}` }, eqA?.nom ?? '?'),
          el('div', { style: 'width:64px;text-align:center;font-weight:900;' }, score),
          el('div', { style: `flex:1;${eqB?.estJoueur ? 'color:var(--or-clair);font-weight:800;' : ''}` }, eqB?.nom ?? '?'),
        ),
      );
    }
  });
  if (coupe.termine) {
    const champion = etat.equipes[coupe.qualifies[0] ?? -1];
    if (champion) panneau.append(el('div', { class: 'centre', style: 'margin-top:8px;font-weight:900;color:var(--or-clair);' }, `🏆 Vainqueur : ${champion.nom}`));
  }
  return panneau;
}

function vueCoupes(): HTMLElement[] {
  const etat = jeu.etat!;
  const joueur = equipeJoueur(etat);
  const sortie: HTMLElement[] = [];
  if (etat.coupe) sortie.push(vueCoupe(etat.coupe));
  else sortie.push(el('div', { class: 'panneau texte-faible' }, `La Coupe du Royaume débutera en semaine 19. Qualifiés : la Ligue d’Or au complet + les 4 premiers des autres divisions (classement à la semaine 18).`));
  if (etat.international) sortie.push(vueCoupe(etat.international));
  else
    sortie.push(
      el(
        'div',
        { class: 'panneau texte-faible' },
        `🌍 Le Tournoi des Champions (semaines 24-26) réunit l'élite mondiale. Réputation requise : 60 — la vôtre : ${Math.round(joueur.reputation)}.`,
      ),
    );
  return sortie;
}

function vueHistorique(): HTMLElement[] {
  const etat = jeu.etat!;
  const joueur = equipeJoueur(etat);
  const panneau = el('div', { class: 'panneau' }, el('h2', null, 'Vos résultats'));
  const miens = etat.resultats.filter((r) => r.domId === joueur.id || r.extId === joueur.id).slice(-30).reverse();
  if (miens.length === 0) panneau.append(el('div', { class: 'texte-faible' }, 'Aucun match disputé pour l’instant.'));
  const nomsComp: Record<MatchResult['competition'], string> = { ligue: 'Ligue', coupe: 'Coupe', international: 'Intl', amical: 'Amical' };
  for (const r of miens) {
    const moi = r.domId === joueur.id;
    const advId = moi ? r.extId : r.domId;
    const pour = moi ? r.scoreDom : r.scoreExt;
    const contre = moi ? r.scoreExt : r.scoreDom;
    const issue = pour > contre ? 'V' : pour < contre ? 'D' : 'N';
    const couleur = issue === 'V' ? 'var(--vert)' : issue === 'D' ? 'var(--rouge)' : 'var(--texte-faible)';
    panneau.append(
      el(
        'div',
        { class: 'ligne-liste', style: 'font-size:13px;' },
        el('div', { style: `width:26px;height:26px;border-radius:50%;background:${couleur};color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;` }, issue),
        el('div', { style: 'flex:1;' }, `${etat.equipes[advId]?.nom ?? '?'}`),
        el('div', { style: 'font-weight:900;width:50px;text-align:center;' }, `${pour}-${contre}`),
        el('div', { class: 'texte-faible', style: 'width:80px;text-align:right;' }, `${nomsComp[r.competition]} · s${r.semaine}`),
      ),
    );
  }
  return [panneau];
}
