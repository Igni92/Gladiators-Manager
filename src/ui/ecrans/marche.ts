/** Marché aux gladiateurs : annonces (achat négocié) + offres reçues des IA. */

import type { AnnonceMarche } from '../../core/types';
import { equipeJoueur, marcheOuvert, SEMAINES_MARCHE } from '../../game/competitions';
import { salaireExige, valeurTransfert } from '../../game/generation';
import { accepterOffre, acheterGladiateur, refuserOffre, relancerOffre, reponseGladiateur, reponseVendeur } from '../../game/marche';
import { rngDe, sauverRng } from '../../game/moteur';
import { carteGladiateur, ficheGladiateur } from '../composants';
import { el, fmtPO, modale, toast } from '../dom';
import { enTete } from '../composants';
import { jeu, type ParamsEcran } from '../jeu';

type Onglet = 'annonces' | 'offres';
let ongletActif: Onglet = 'annonces';

export function rendreMarche(params: ParamsEcran = {}): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';

  const ouvert = marcheOuvert(etat.semaine);
  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-marche' });
  ecran.append(enTete('Marché aux gladiateurs'));

  const barre = el('div', { class: 'onglets' });
  barre.append(
    el('button', { class: `onglet ${ongletActif === 'annonces' ? 'actif' : ''}`, 'data-testid': 'onglet-annonces', onclick: () => { ongletActif = 'annonces'; rendreMarche(); } }, `Annonces (${etat.marche.length})`),
    el('button', { class: `onglet ${ongletActif === 'offres' ? 'actif' : ''}`, 'data-testid': 'onglet-offres', onclick: () => { ongletActif = 'offres'; rendreMarche(); } }, `Offres reçues (${etat.offresRecues.length})`),
  );
  ecran.append(barre);

  const contenu = el('div', { class: 'contenu' });
  if (!ouvert) {
    const prochaine = SEMAINES_MARCHE.find((s) => s > etat.semaine) ?? 1;
    contenu.append(
      el(
        'div',
        { class: 'panneau centre' },
        el('h2', null, '🔒 Marché fermé'),
        el('div', { style: 'font-size:14px;line-height:1.5;' },
          'Les transferts ne se font qu’ENTRE les compétitions : pré-saison (S1-S2), mi-saison (S17-S18) et intersaison (S27-S30).',
          el('br'), `Prochaine fenêtre : semaine ${prochaine > etat.semaine ? prochaine : '1 (saison prochaine)'}.`),
      ),
    );
  }

  if (ongletActif === 'annonces') {
    contenu.append(...vueAnnonces(ouvert, params));
  } else {
    contenu.append(...vueOffres(ouvert));
  }
  ecran.append(contenu);
  racine.append(ecran);
}

function vueAnnonces(ouvert: boolean, params: ParamsEcran): HTMLElement[] {
  const etat = jeu.etat!;
  const sortie: HTMLElement[] = [];
  if (etat.marche.length === 0) {
    sortie.push(el('div', { class: 'panneau centre texte-faible' }, 'Aucune annonce pour le moment.'));
    return sortie;
  }
  const grille = el('div', { class: 'grille-cartes' });
  for (const annonce of etat.marche) {
    const g = etat.gladiateurs[annonce.gladiateurId];
    if (!g) continue;
    const vendeur = annonce.vendeurId >= 0 ? etat.equipes[annonce.vendeurId]?.nom : 'Agent libre';
    const carte = el(
      'div',
      { style: 'display:flex;flex-direction:column;align-items:center;gap:6px;' },
      carteGladiateur(g, { onTap: () => (ouvert ? ouvrirNegociation(annonce) : toast('Le marché est fermé.')) }),
      el('div', { style: 'font-weight:900;color:var(--or-clair);font-size:14px;' }, fmtPO(annonce.prixDemande)),
      el('div', { class: 'texte-faible', style: 'font-size:11px;' }, vendeur ?? ''),
    );
    grille.append(carte);
  }
  sortie.push(grille);

  // ouverture directe depuis la taverne
  if (params.gladiateurId !== undefined && ouvert) {
    const annonce = etat.marche.find((a) => a.gladiateurId === params.gladiateurId);
    if (annonce) setTimeout(() => ouvrirNegociation(annonce), 60);
  }
  return sortie;
}

/** Négociation d'achat : prix au vendeur, puis salaire au gladiateur. */
function ouvrirNegociation(annonce: AnnonceMarche): void {
  const etat = jeu.etat!;
  const g = etat.gladiateurs[annonce.gladiateurId];
  if (!g) return;
  const joueur = equipeJoueur(etat);
  const exige = salaireExige(g);

  let prixPropose = Math.min(annonce.prixDemande, Math.round((valeurTransfert(g) * 0.9) / 10) * 10);
  let salairePropose = exige;

  const dialogue = el('div', { class: 'bulle eux' }, annonce.vendeurId >= 0
    ? `« ${etat.equipes[annonce.vendeurId]?.nom ?? 'Le vendeur'} en demande ${fmtPO(annonce.prixDemande)}. Faites votre offre. »`
    : `« Je me vends moi-même, et je ne suis pas bon marché : ${fmtPO(annonce.prixDemande)}. »`);

  const prixLabel = el('div', { class: 'nego-valeur' }, fmtPO(prixPropose));
  const prixCurseur = el('input', {
    type: 'range', class: 'nego-curseur', 'data-testid': 'curseur-prix',
    min: String(Math.round(annonce.prixDemande * 0.4)), max: String(Math.round(annonce.prixDemande * 1.2)), step: '10', value: String(prixPropose),
  }) as HTMLInputElement;
  prixCurseur.addEventListener('input', () => {
    prixPropose = Number(prixCurseur.value);
    prixLabel.textContent = fmtPO(prixPropose);
  });

  const salaireLabel = el('div', { class: 'nego-valeur' }, `${fmtPO(salairePropose)}/sem`);
  const salaireCurseur = el('input', {
    type: 'range', class: 'nego-curseur', 'data-testid': 'curseur-salaire',
    min: String(Math.max(1, Math.round(exige * 0.6))), max: String(Math.round(exige * 1.6)), step: '1', value: String(salairePropose),
  }) as HTMLInputElement;
  salaireCurseur.addEventListener('input', () => {
    salairePropose = Number(salaireCurseur.value);
    salaireLabel.textContent = `${fmtPO(salairePropose)}/sem`;
  });

  const btnProposer = el(
    'button',
    {
      class: 'btn principal large',
      'data-testid': 'btn-proposer',
      onclick: () => {
        if (joueur.tresorerie < prixPropose) {
          toast('Trésorerie insuffisante !');
          return;
        }
        const rng = rngDe(etat);
        const rep = reponseVendeur(annonce, prixPropose, rng);
        sauverRng(etat, rng);
        if (rep.type === 'refuse') {
          annonce.tentatives++;
          dialogue.textContent = '« C’est une insulte ! Revenez avec une vraie offre. »';
          dialogue.className = 'bulle eux';
          jeu.sauver();
          return;
        }
        if (rep.type === 'contre') {
          annonce.tentatives++;
          annonce.prixDemande = rep.prix;
          dialogue.textContent = `« Hmm… disons ${fmtPO(rep.prix)} et il est à vous. »`;
          prixCurseur.max = String(Math.round(rep.prix * 1.2));
          jeu.sauver();
          return;
        }
        // prix accepté → le gladiateur examine le salaire
        const repG = reponseGladiateur(g, salairePropose);
        if (repG.type === 'exige') {
          dialogue.textContent = `${g.nom} : « Pour ce salaire ? Jamais. Je veux ${fmtPO(repG.salaire)}/semaine. »`;
          return;
        }
        acheterGladiateur(etat, annonce, prixPropose, salairePropose);
        jeu.sauver();
        fermer();
        toast(`🎉 ${g.nom} rejoint votre écurie !`);
        rendreMarche();
      },
    },
    '🤝 Proposer',
  );

  const contenu = el(
    'div',
    null,
    ficheGladiateur(g),
    dialogue,
    el('div', { class: 'panneau' },
      el('h2', null, 'Prix de transfert'),
      prixLabel, prixCurseur,
      el('h2', { style: 'margin-top:10px;' }, `Salaire proposé (il exige ~${fmtPO(exige)})`),
      salaireLabel, salaireCurseur,
    ),
    btnProposer,
  );
  const fermer = modale(contenu);
}

function vueOffres(ouvert: boolean): HTMLElement[] {
  const etat = jeu.etat!;
  const sortie: HTMLElement[] = [];
  if (etat.offresRecues.length === 0) {
    sortie.push(
      el('div', { class: 'panneau centre texte-faible' },
        ouvert ? 'Aucune offre pour vos gladiateurs cette semaine. Les écuries rivales se manifestent pendant les fenêtres de transfert.' : 'Les offres arrivent pendant les fenêtres de transfert.'),
    );
    return sortie;
  }
  for (const offre of [...etat.offresRecues]) {
    const g = etat.gladiateurs[offre.gladiateurId];
    const acheteur = etat.equipes[offre.equipeId];
    if (!g || !acheteur) continue;
    const panneau = el(
      'div',
      { class: 'panneau' },
      el('h2', null, `${acheteur.nom} convoite ${g.nom}`),
      el('div', { style: 'display:flex;gap:12px;align-items:center;' },
        carteGladiateur(g, { petite: true }),
        el('div', { style: 'flex:1;' },
          el('div', { style: 'font-size:22px;font-weight:900;color:var(--or-clair);margin-bottom:4px;', 'data-testid': 'prix-offre' }, fmtPO(offre.prix)),
          el('div', { class: 'texte-faible', style: 'margin-bottom:10px;' }, `Valeur estimée : ${fmtPO(valeurTransfert(g))} · expire sem. ${offre.expire}`),
          el('div', { style: 'display:flex;flex-direction:column;gap:6px;' },
            el('button', {
              class: 'btn principal', 'data-testid': 'btn-accepter-offre',
              onclick: () => {
                accepterOffre(etat, offre);
                jeu.sauver();
                toast(`💰 ${g.nom} vendu pour ${fmtPO(offre.prix)}.`);
                rendreMarche();
              },
            }, '✅ Accepter'),
            el('button', {
              class: 'btn', 'data-testid': 'btn-relancer-offre',
              onclick: () => {
                const rng = rngDe(etat);
                const rep = relancerOffre(offre, rng);
                sauverRng(etat, rng);
                if (rep.type === 'retire') {
                  refuserOffre(etat, offre);
                  toast(`${acheteur.nom} retire son offre, vexée.`);
                } else {
                  toast(`${acheteur.nom} monte à ${fmtPO(rep.prix)} !`);
                }
                jeu.sauver();
                rendreMarche();
              },
            }, '📈 Exiger plus (risqué)'),
            el('button', {
              class: 'btn danger', 'data-testid': 'btn-refuser-offre',
              onclick: () => {
                refuserOffre(etat, offre);
                jeu.sauver();
                rendreMarche();
              },
            }, '❌ Refuser'),
          ),
        ),
      ),
    );
    sortie.push(panneau);
  }
  return sortie;
}
