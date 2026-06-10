/** Taverne : rumeurs du marché, ambiance, tournée générale pour le moral. */

import { equipeJoueur, marcheOuvert } from '../../game/competitions';
import { ajouterFinance, clamp } from '../../game/economie';
import { enTete } from '../composants';
import { el, fmtPO, toast } from '../dom';
import { jeu } from '../jeu';

const COUT_TOURNEE = 30;

export function rendreTaverne(): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-taverne' });
  ecran.append(enTete('Taverne du Glaive Rouillé'));
  const contenu = el('div', { class: 'contenu' });

  // rumeurs
  const panneau = el('div', { class: 'panneau' }, el('h2', null, '🍺 Rumeurs de comptoir'));
  if (etat.rumeurs.length === 0) {
    panneau.append(el('div', { class: 'texte-faible' }, 'Le comptoir est silencieux ce soir…'));
  }
  for (const r of etat.rumeurs) {
    const ligne = el('div', { class: 'ligne-liste', style: 'font-size:13.5px;font-style:italic;' }, `« ${r.texte} »`);
    if (r.gladiateurId >= 0) {
      ligne.append(
        el('button', {
          class: 'btn mini', style: 'margin-left:auto;flex-shrink:0;',
          onclick: () => jeu.aller('marche', { gladiateurId: r.gladiateurId }),
        }, marcheOuvert(etat.semaine) ? 'Voir ➜' : 'Marché 🔒'),
      );
    }
    panneau.append(ligne);
  }
  contenu.append(panneau);

  // tournée générale
  const dejaPayee = etat.flags[`tournee_s${etat.saison}_${etat.semaine}`] === true;
  contenu.append(
    el('div', { class: 'panneau centre' },
      el('h2', null, 'Payer une tournée générale'),
      el('div', { class: 'texte-faible', style: 'margin-bottom:10px;' }, `Vos gladiateurs trinquent, le moral remonte (+4). ${fmtPO(COUT_TOURNEE)}.`),
      el('button', {
        class: 'btn large', 'data-testid': 'btn-tournee', disabled: dejaPayee || joueur.tresorerie < COUT_TOURNEE,
        onclick: () => {
          ajouterFinance(etat, 'Tournée à la taverne', -COUT_TOURNEE);
          for (const id of joueur.gladiateurIds) {
            const g = etat.gladiateurs[id];
            if (g) g.moral = clamp(g.moral + 4, 0, 100);
          }
          etat.flags[`tournee_s${etat.saison}_${etat.semaine}`] = true;
          jeu.sauver();
          toast('🍻 Santé ! Le moral de l’écurie remonte.');
          rendreTaverne();
        },
      }, dejaPayee ? '🍻 Déjà fait cette semaine' : '🍻 Tournée ! (+4 moral)'),
    ),
  );

  contenu.append(
    el('div', { class: 'panneau texte-faible' },
      '💡 Le tavernier sait tout : les offres de rachat pour vos gladiateurs apparaissent au Marché (onglet « Offres reçues ») pendant les fenêtres de transfert.'),
  );
  ecran.append(contenu);
  racine.append(ecran);
}
