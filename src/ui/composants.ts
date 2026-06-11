/** Composants réutilisables : carte de gladiateur façon FIFA, barres, en-têtes. */

import type { Gladiator } from '../core/types';
import { TIER_COULEURS } from '../data/balance';
import { ABREV_TRAITS, NOMS_CLASSES, NOMS_PERSONNALITES } from '../data/noms';
import { noteGlobale, palierDeGladiateur, salaireExige, valeurTransfert, TRAIT_IDS } from '../game/generation';
import { satisfaction } from '../game/economie';
import { assets } from '../render/assets';
import { el, fmtPO, icone } from './dom';
import { jeu } from './jeu';
import { TALENTS } from '../data/talents';
import { ICONES_RACES, NOMS_RACES } from '../data/races';

export const ICONES_CLASSES: Record<string, string> = {
  colosse: '🛡️',
  bretteur: '⚔️',
  roublard: '🗡️',
  lancier: '🔱',
  mage: '🔮',
  berserker: '🪓',
};

/** Carte compacte façon FIFA (tap → fiche détaillée par défaut). */
export function carteGladiateur(g: Gladiator, opts: { onTap?: () => void; bandeau?: string; petite?: boolean } = {}): HTMLElement {
  const ovr = noteGlobale(g.traits, g.classe);
  const palier = palierDeGladiateur(g);
  const couleurs = TIER_COULEURS[palier];
  const carte = el('div', { class: `carte-glad ${opts.petite ? 'petite' : ''}`, style: `background:${couleurs.fond};color:${couleurs.texte}` });

  const haut = el(
    'div',
    { class: 'cg-haut' },
    el('div', { class: 'cg-ovr' }, el('div', { class: 'cg-note' }, String(ovr)), el('div', { class: 'cg-palier' }, palier)),
    el('div', { class: 'cg-classe' }, `${ICONES_CLASSES[g.classe] ?? ''}`, el('span', null, NOMS_CLASSES[g.classe]),
      el('span', { class: 'cg-race' }, `${ICONES_RACES[g.race ?? 'humain']} ${NOMS_RACES[g.race ?? 'humain']}`)),
  );

  const img = el('img', { class: 'cg-portrait', src: assets.portraitUrlRace(g.race ?? 'humain', g.genre ?? 'm', g.classe), alt: g.classe }) as HTMLImageElement;
  img.onerror = () => {
    img.onerror = null;
    img.src = assets.portraitUrl(g.classe, g.variante);
  };
  const statuts = el('div', { class: 'cg-statuts' });
  // talents : icône si découvert, « ? » s'il en reste à découvrir
  const connus = g.talentsConnus ?? [];
  const inconnus = (g.talents ?? []).filter((t) => !connus.includes(t));
  const coinTalents = el('div', { class: 'cg-talents' });
  for (const t of connus) coinTalents.append(el('span', { class: 'cg-talent', title: TALENTS[t].nom }, icone(t, 20)));
  if (inconnus.length > 0) coinTalents.append(el('span', { class: 'cg-talent inconnu' }, '?'));
  if (coinTalents.childElementCount > 0) carte.append(coinTalents);
  if (g.blessure) statuts.append(el('span', { class: 'badge-statut blesse' }, `🩹 ${g.blessure.semaines} sem.`));
  if (g.moral < 35) statuts.append(el('span', { class: 'badge-statut grognon' }, '😠'));
  else if (g.moral > 75) statuts.append(el('span', { class: 'badge-statut content' }, '😄'));
  if (g.fatigue > 65) statuts.append(el('span', { class: 'badge-statut fatigue' }, '🥱'));

  const traits = el('div', { class: 'cg-traits' });
  for (const t of TRAIT_IDS) {
    traits.append(el('div', { class: 'cg-trait' }, el('b', null, String(g.traits[t])), el('span', null, ABREV_TRAITS[t])));
  }

  carte.append(
    haut,
    el('div', { class: 'cg-centre' }, img, statuts),
    el('div', { class: 'cg-nom' }, g.nom),
    traits,
    el('div', { class: 'cg-pied' }, `${g.age} ans · ${fmtPO(g.salaire)}/sem`),
  );
  if (opts.bandeau) carte.append(el('div', { class: 'cg-bandeau' }, opts.bandeau));
  if (opts.onTap) carte.addEventListener('click', opts.onTap);
  return carte;
}

export function barre(valeur: number, max: number, classe = ''): HTMLElement {
  const pct = Math.max(0, Math.min(100, (valeur / max) * 100));
  return el('div', { class: `barre ${classe}` }, el('div', { class: 'barre-rempli', style: `width:${pct}%` }));
}

/** Fiche détaillée (modale) avec zone d'actions personnalisable. */
export function ficheGladiateur(g: Gladiator, actions: HTMLElement[] = []): HTMLElement {
  const ovr = noteGlobale(g.traits, g.classe);
  const exige = salaireExige(g);
  const sat = satisfaction(g);
  const satTexte = sat >= 1.05 ? '😄 très satisfait' : sat >= 0.95 ? '🙂 satisfait' : sat >= 0.8 ? '😒 mécontent' : '😠 furieux';
  const fiche = el('div', { class: 'fiche-glad' });
  const connus = g.talentsConnus ?? [];
  const nbInconnus = (g.talents ?? []).filter((t) => !connus.includes(t)).length;
  const blocTalents = el('div', { class: 'fiche-talents' });
  for (const t of connus) {
    blocTalents.append(
      el('div', { class: 'ligne-liste', style: 'font-size:12.5px;' },
        icone(t, 26),
        el('div', { style: 'flex:1;' }, el('b', null, TALENTS[t].nom, ' — '), TALENTS[t].description)),
    );
  }
  if (nbInconnus > 0) {
    blocTalents.append(
      el('div', { class: 'ligne-liste texte-faible', style: 'font-size:12.5px;' },
        icone('talent', 26),
        el('div', { style: 'flex:1;' }, `${nbInconnus} talent${nbInconnus > 1 ? 's' : ''} caché${nbInconnus > 1 ? 's' : ''} — se révèle quand il se déclenche dans vos matchs.`)),
    );
  }
  fiche.append(
    carteGladiateur(g),
    el(
      'div',
      { class: 'fiche-infos' },
      ligne('Race', `${ICONES_RACES[g.race ?? 'humain']} ${NOMS_RACES[g.race ?? 'humain']}`),
      ligne('Personnalité', NOMS_PERSONNALITES[g.personnalite]),
      ligne('Potentiel', `${ovr} → ${g.potentiel}`),
      ligneBarre('Moral', g.moral),
      ligneBarre('Forme', g.forme),
      ligneBarre('Fatigue', g.fatigue, 'inverse'),
      ligne('Salaire', `${fmtPO(g.salaire)}/sem — exige ${fmtPO(exige)} (${satTexte})`),
      ligne('Valeur estimée', fmtPO(valeurTransfert(g))),
      g.blessure ? ligne('Blessure', `${g.blessure.type} — ${g.blessure.semaines} sem.`) : null,
      ligne('Carrière', `${g.stats.combats} combats · ${g.stats.victoires} V · ${g.stats.elims} élim.`),
    ),
  );
  if ((g.talents ?? []).length > 0) {
    fiche.append(el('div', { class: 'fiche-infos' }, el('h2', { style: 'color:var(--or-clair);font-size:13px;margin-bottom:4px;' }, '✨ Talents'), blocTalents));
  }
  fiche.append(el('div', { class: 'fiche-actions' }, ...actions));
  return fiche;
}

function ligne(titre: string, valeur: string): HTMLElement {
  return el('div', { class: 'fiche-ligne' }, el('span', { class: 'fiche-cle' }, titre), el('span', { class: 'fiche-val' }, valeur));
}

function ligneBarre(titre: string, valeur: number, classe = ''): HTMLElement {
  return el(
    'div',
    { class: 'fiche-ligne' },
    el('span', { class: 'fiche-cle' }, titre),
    el('div', { class: 'fiche-barre' }, barre(valeur, 100, classe), el('span', { class: 'fiche-val-num' }, String(Math.round(valeur)))),
  );
}

/** En-tête d'écran avec retour à la ville, aide contextuelle et trésorerie. */
export function enTete(titre: string, retour: () => void = () => jeu.aller('ville'), aideId?: string): HTMLElement {
  const etat = jeu.etat;
  const tresorerie = etat ? (etat.equipes[etat.equipeJoueurId]?.tresorerie ?? 0) : 0;
  const entete = el(
    'header',
    { class: 'entete' },
    el('button', { class: 'btn-retour', onclick: retour }, '‹'),
    el('h1', null, titre),
  );
  if (aideId) {
    entete.append(
      el('button', {
        class: 'btn-aide', 'data-testid': 'btn-aide',
        onclick: () => void import('./tuto').then((m) => m.ouvrirAide(aideId)),
      }, '?'),
    );
  }
  entete.append(el('div', { class: 'entete-po', 'data-testid': 'tresorerie' }, icone('po', 17), ' ', fmtPO(tresorerie)));
  return entete;
}
