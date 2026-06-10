/** Infirmerie : blessés et soins payants. */

import { equipeJoueur } from '../../game/competitions';
import { payerGuerisseur } from '../../game/moteur';
import { BALANCE } from '../../data/balance';
import { carteGladiateur, enTete } from '../composants';
import { el, fmtPO, toast } from '../dom';
import { jeu } from '../jeu';

export function rendreInfirmerie(): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-infirmerie' });
  ecran.append(enTete('Infirmerie'));
  const contenu = el('div', { class: 'contenu' });

  const blesses = joueur.gladiateurIds
    .map((id) => etat.gladiateurs[id])
    .filter((g) => g && g.blessure);

  if (blesses.length === 0) {
    contenu.append(
      el('div', { class: 'panneau centre' },
        el('div', { style: 'font-size:40px;margin:10px 0;' }, '🌿'),
        el('div', null, 'Personne à l’infirmerie. Vos gladiateurs sont sur pied !'),
        el('div', { class: 'texte-faible', style: 'margin-top:8px;' }, 'Les blessures surviennent surtout après un K.O. en match officiel.')),
    );
  }

  for (const g of blesses) {
    if (!g || !g.blessure) continue;
    contenu.append(
      el('div', { class: 'panneau', style: 'display:flex;gap:12px;align-items:center;' },
        carteGladiateur(g, { petite: true }),
        el('div', { style: 'flex:1;' },
          el('div', { style: 'font-weight:800;margin-bottom:4px;' }, g.blessure.type),
          el('div', { class: 'texte-faible', style: 'margin-bottom:10px;' }, `Indisponible encore ${g.blessure.semaines} semaine${g.blessure.semaines > 1 ? 's' : ''}.`),
          el('button', {
            class: 'btn principal', 'data-testid': `btn-soigner-${g.id}`,
            disabled: joueur.tresorerie < BALANCE.COUT_GUERISSEUR,
            onclick: () => {
              if (payerGuerisseur(etat, g.id)) {
                jeu.sauver();
                toast('Le guérisseur a fait des merveilles (−1 semaine).');
                rendreInfirmerie();
              }
            },
          }, `💊 Guérisseur (${fmtPO(BALANCE.COUT_GUERISSEUR)}) : −1 sem.`),
        ),
      ),
    );
  }
  ecran.append(contenu);
  racine.append(ecran);
}
