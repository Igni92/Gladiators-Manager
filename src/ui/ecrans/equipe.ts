/** Écran équipe : effectif, fiche détaillée, ajustement de salaire, libération. */

import type { Gladiator } from '../../core/types';
import { equipeJoueur } from '../../game/competitions';
import { noteGlobale, salaireExige } from '../../game/generation';
import { changerSalaire } from '../../game/moteur';
import { masseSalariale } from '../../game/economie';
import { ajouterFinance } from '../../game/economie';
import { carteGladiateur, enTete, ficheGladiateur } from '../composants';
import { el, fmtPO, modale, toast } from '../dom';
import { jeu } from '../jeu';

export function rendreEquipe(): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-equipe' });
  ecran.append(enTete(`${joueur.nom}`, () => jeu.aller('ville'), 'equipe'));
  const contenu = el('div', { class: 'contenu' });

  contenu.append(
    el('div', { class: 'panneau centre texte-faible' },
      `${joueur.gladiateurIds.length} gladiateurs · masse salariale ${fmtPO(masseSalariale(etat, joueur))}/sem · réputation ${Math.round(joueur.reputation)}/100`),
  );

  const grille = el('div', { class: 'grille-cartes' });
  const gs = joueur.gladiateurIds
    .map((id) => etat.gladiateurs[id])
    .filter((g): g is Gladiator => !!g)
    .sort((a, b) => noteGlobale(b.traits, b.classe) - noteGlobale(a.traits, a.classe));
  for (const g of gs) {
    grille.append(carteGladiateur(g, { onTap: () => ouvrirFiche(g) }));
  }
  contenu.append(grille);
  ecran.append(contenu);
  racine.append(ecran);
}

function ouvrirFiche(g: Gladiator): void {
  const etat = jeu.etat!;
  const joueur = equipeJoueur(etat);

  const exige = salaireExige(g);
  let nouveauSalaire = g.salaire;
  const salaireLabel = el('div', { class: 'nego-valeur' }, `${fmtPO(nouveauSalaire)}/sem`);
  const curseur = el('input', {
    type: 'range', class: 'nego-curseur', 'data-testid': 'curseur-salaire-equipe',
    min: '1', max: String(Math.max(g.salaire * 2, Math.round(exige * 1.6))), step: '1', value: String(g.salaire),
  }) as HTMLInputElement;
  curseur.addEventListener('input', () => {
    nouveauSalaire = Number(curseur.value);
    salaireLabel.textContent = `${fmtPO(nouveauSalaire)}/sem`;
  });

  const indemnite = g.salaire * 4;
  const actions = [
    el('div', { class: 'panneau', style: 'width:100%;' },
      el('h2', null, `Ajuster le salaire (exige ~${fmtPO(exige)})`),
      salaireLabel,
      curseur,
      el('button', {
        class: 'btn large', 'data-testid': 'btn-appliquer-salaire',
        onclick: () => {
          if (nouveauSalaire === g.salaire) return;
          const baisse = nouveauSalaire < g.salaire;
          changerSalaire(etat, g.id, nouveauSalaire);
          jeu.sauver();
          toast(baisse ? `${g.nom} encaisse mal la baisse… (moral -8)` : `${g.nom} apprécie le geste (moral +4).`);
          fermer();
          rendreEquipe();
        },
      }, 'Appliquer'),
    ),
    el('button', {
      class: 'btn danger large', 'data-testid': 'btn-liberer',
      onclick: () => {
        if (joueur.tresorerie < indemnite) {
          toast(`Indemnité de rupture impayable (${fmtPO(indemnite)}).`);
          return;
        }
        ajouterFinance(etat, `Indemnité de départ : ${g.nom}`, -indemnite);
        joueur.gladiateurIds = joueur.gladiateurIds.filter((id) => id !== g.id);
        delete etat.gladiateurs[g.id];
        jeu.sauver();
        toast(`${g.nom} quitte l’écurie.`);
        fermer();
        rendreEquipe();
      },
    }, `🚪 Libérer (indemnité ${fmtPO(indemnite)})`),
  ];

  const fermer = modale(ficheGladiateur(g, actions));
}
