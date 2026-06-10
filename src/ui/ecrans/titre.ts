/** Écran titre : nouvelle partie / continuer. */

import { aUneSauvegarde, chargerSauvegarde, effacerSauvegarde } from '../../core/save';
import { nouvellePartie } from '../../game/etat';
import { el, modale, toast } from '../dom';
import { jeu } from '../jeu';

export function rendreTitre(): void {
  const racine = jeu.racine();
  racine.innerHTML = '';

  const fond = el('div', { class: 'ecran titre-ecran', 'data-testid': 'ecran-titre' });
  const url = `${import.meta.env.BASE_URL}assets/ui/title_hero.png`;
  fond.style.backgroundImage = `url(${url})`;
  fond.append(el('div', { class: 'titre-voile' }));

  const logo = el(
    'div',
    { class: 'titre-logo' },
    el('h1', null, 'GLADIATORS', el('br'), 'MANAGER'),
    el('div', { class: 'sous' }, 'Sang, or et gloire'),
  );

  const boutons = el('div', { class: 'titre-boutons' });
  if (aUneSauvegarde()) {
    boutons.append(
      el(
        'button',
        {
          class: 'btn principal large',
          'data-testid': 'btn-continuer',
          onclick: () => {
            const etat = chargerSauvegarde();
            if (etat) {
              jeu.etat = etat;
              jeu.aller('ville');
            } else {
              toast('Sauvegarde illisible.');
            }
          },
        },
        '⚔️ Continuer la partie',
      ),
    );
  }
  boutons.append(
    el(
      'button',
      {
        class: `btn large ${aUneSauvegarde() ? '' : 'principal'}`,
        'data-testid': 'btn-nouvelle',
        onclick: () => demanderNom(),
      },
      '🏛️ Nouvelle partie',
    ),
  );

  fond.append(logo, boutons);
  racine.append(fond);
}

function demanderNom(): void {
  const dejaUneSave = aUneSauvegarde();
  const input = el('input', {
    type: 'text',
    value: 'Écurie du Lion',
    maxlength: '24',
    style: 'width:100%;padding:12px;border-radius:10px;border:1px solid var(--bord);background:#1a1208;color:var(--parchemin);font-size:16px;',
  }) as HTMLInputElement;
  const contenu = el(
    'div',
    null,
    el('h2', { style: 'color:var(--or-clair);margin-bottom:10px;font-size:18px;' }, 'Nom de votre écurie'),
    dejaUneSave ? el('p', { class: 'texte-faible', style: 'margin-bottom:10px;' }, '⚠️ La partie en cours sera écrasée.') : null,
    input,
    el('div', { class: 'sep' }),
    el(
      'button',
      {
        class: 'btn principal large',
        'data-testid': 'btn-commencer',
        onclick: () => {
          effacerSauvegarde();
          jeu.etat = nouvellePartie(Date.now() >>> 0, input.value.trim() || 'Écurie du Lion');
          jeu.sauver();
          fermer();
          jeu.aller('ville');
          toast('Bienvenue, manager ! Recrutez au Marché et préparez la saison.');
        },
      },
      'Fonder l’écurie',
    ),
  );
  const fermer = modale(contenu);
}
