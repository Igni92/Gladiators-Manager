/** Caserne : programme d'entraînement hebdomadaire (un trait par gladiateur, ou repos). */

import { equipeJoueur } from '../../game/competitions';
import { noteGlobale, TRAIT_IDS } from '../../game/generation';
import { ABREV_TRAITS } from '../../data/noms';
import { BALANCE } from '../../data/balance';
import type { Gladiator, TraitId } from '../../core/types';
import { barre, enTete } from '../composants';
import { el, fmtPO } from '../dom';
import { jeu } from '../jeu';

export function rendreCaserne(): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-caserne' });
  ecran.append(enTete('Caserne — entraînement'));
  const contenu = el('div', { class: 'contenu' });
  contenu.append(
    el('div', { class: 'panneau texte-faible' },
      'Choisissez le programme de la semaine : un trait à travailler (coût en PO, fatigue +', String(BALANCE.FATIGUE_ENTRAINEMENT),
      ') ou du repos (fatigue −', String(BALANCE.RECUP_REPOS), '). Appliqué en fin de semaine. Les jeunes progressent plus vite ; au-delà du potentiel, on n’avance plus.'),
  );

  for (const id of joueur.gladiateurIds) {
    const g = etat.gladiateurs[id];
    if (!g) continue;
    contenu.append(panneauGladiateur(g));
  }
  ecran.append(contenu);
  racine.append(ecran);
}

function panneauGladiateur(g: Gladiator): HTMLElement {
  const etat = jeu.etat!;
  const ovr = noteGlobale(g.traits, g.classe);
  const cout = Math.round(BALANCE.COUT_ENTR_BASE + ovr * BALANCE.COUT_ENTR_PENTE);
  const plafonne = ovr >= g.potentiel;

  const panneau = el('div', { class: 'panneau' });
  panneau.append(
    el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;' },
      el('div', { style: 'font-weight:800;' }, `${g.nom} `, el('span', { class: 'texte-faible' }, `(${ovr}${plafonne ? ' · potentiel atteint' : ` → ${g.potentiel}`})`)),
      el('div', { class: 'texte-faible' }, g.blessure ? `🩹 blessé ${g.blessure.semaines} sem.` : `${fmtPO(cout)}/sem`),
    ),
    el('div', { style: 'display:flex;align-items:center;gap:8px;margin:6px 0;' },
      el('span', { class: 'texte-faible', style: 'width:54px;font-size:12px;' }, 'Fatigue'),
      barre(g.fatigue, 100, 'inverse'),
      el('span', { style: 'font-size:12px;width:24px;text-align:right;' }, String(Math.round(g.fatigue))),
    ),
  );

  const chips = el('div', { class: 'chips' });
  const choixActuel = etat.entrainement[g.id];
  const faireChip = (libelle: string, valeur: TraitId | 'repos' | null) => {
    const actif = valeur === null ? choixActuel === undefined : choixActuel === valeur;
    return el(
      'button',
      {
        class: `chip ${actif ? 'actif' : ''}`,
        'data-testid': valeur ? `entr-${g.id}-${valeur}` : `entr-${g.id}-rien`,
        onclick: () => {
          if (valeur === null) delete etat.entrainement[g.id];
          else etat.entrainement[g.id] = valeur;
          jeu.sauver();
          rendreCaserne();
        },
      },
      libelle,
    );
  };
  chips.append(faireChip('— Rien', null));
  chips.append(faireChip('😴 Repos', 'repos'));
  if (!g.blessure) {
    for (const t of TRAIT_IDS) {
      chips.append(faireChip(`${ABREV_TRAITS[t]} ${g.traits[t]}`, t));
    }
  }
  panneau.append(chips);
  return panneau;
}
