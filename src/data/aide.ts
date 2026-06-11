/** Tous les textes d'aide du jeu : traits, classes, écrans, mécaniques. */

import type { ClassId, TraitId } from '../core/types';

export const AIDE_TRAITS: Record<TraitId, { titre: string; texte: string }> = {
  force: { titre: 'Force', texte: 'Dégâts au corps à corps et points de vie. Le trait des cogneurs.' },
  vitesse: { titre: 'Vitesse', texte: 'Vitesse de déplacement et cadence d’attaque dans l’arène.' },
  intelligence: {
    titre: 'Intelligence',
    texte: 'Réactivité, choix des cibles, garde (réduction des dégâts subis) et BLOCAGE. Le blocage est bien plus efficace contre les attaques à distance que contre le corps à corps.',
  },
  fourberie: {
    titre: 'Fourberie',
    texte: 'Chances de coup critique (doublées dans le dos) et puissance/portée des ATTAQUES À DISTANCE : couteaux du roublard, javelots du lancier.',
  },
  esquive: { titre: 'Esquive', texte: 'Chance d’éviter complètement une attaque de mêlée (moitié moins efficace contre les projectiles).' },
  magie: { titre: 'Magie', texte: 'À partir de 60 : lance des sorts en combat (boule de feu, nova de zone, soin). Les mages sont rares et chers.' },
};

export const AIDE_CLASSES: Record<ClassId, string> = {
  colosse: 'Tank lourd : énormément de PV, grosse masse d’armes, bloque bien (bouclier). Lent. À placer DEVANT.',
  bretteur: 'Combattant équilibré : glaive et grand bouclier (bon blocage). Fiable en première ligne.',
  roublard: 'Assassin agile : critiques, esquive, et COUTEAUX DE LANCER à distance (Fourberie). Fragile, à placer au centre ou en flanc.',
  lancier: 'Soldat polyvalent : longue portée de mêlée, JAVELOTS à distance (Fourberie) et petit bouclier. Très bon en colonne centrale.',
  mage: 'Lanceur de sorts : boule de feu, nova, soins. Dévastateur mais fragile — TOUJOURS à l’arrière.',
  berserker: 'Furie pure : dégâts et vitesse énormes, aucune défense. Devant, pour frapper le premier.',
};

export const AIDE_ECRANS: Record<string, { titre: string; texte: string[] }> = {
  ville: {
    titre: 'La ville',
    texte: [
      'Touchez un bâtiment pour ouvrir l’écran correspondant : Arène (matchs et classements), Marché (transferts), Caserne (entraînement), Taverne (rumeurs et recrutement), Banque (finances), Infirmerie (soins).',
      'Le bouton « Semaine suiv. » fait avancer le temps : entraînements appliqués, salaires payés, matchs des autres équipes joués.',
      'Si un match vous attend, jouez-le avant de finir la semaine, sinon : forfait (défaite 0-3) !',
    ],
  },
  arene: {
    titre: 'L’Arène',
    texte: [
      'Saison de 30 semaines : 14 journées de ligue (S3-S16), Coupe du Royaume (S19-S22, qualifiés : Ligue d’Or + top 4 des autres divisions), Tournoi des Champions international (S24-S26, réputation 60 requise).',
      'Victoire = 3 pts, nul = 1 pt. Les 2 premiers montent de division, les 2 derniers descendent.',
      'Les semaines libres permettent d’organiser des amicaux sans enjeu (risque de blessure réduit) pour tester vos recrues.',
    ],
  },
  marche: {
    titre: 'Le Marché',
    texte: [
      'Ouvert UNIQUEMENT entre les compétitions : semaines 1-2 (pré-saison), 17-18 (mi-saison) et 27-30 (intersaison).',
      'Acheter : négociez le PRIX avec le vendeur (il peut contre-proposer), puis le SALAIRE avec le gladiateur (il a ses exigences selon son palier et sa personnalité).',
      'Vendre : les écuries rivales font des offres sur vos gladiateurs. Vous pouvez exiger plus… mais elles peuvent se vexer et tout retirer.',
      'Les chances d’apparition des hauts paliers (affichées à la Taverne) augmentent avec votre réputation.',
      'Un « ? » sur une carte signale un talent caché non découvert : un pari qui peut rapporter gros.',
    ],
  },
  caserne: {
    titre: 'La Caserne',
    texte: [
      'Chaque semaine, assignez à chaque gladiateur un trait à travailler, ou du repos.',
      'L’entraînement coûte des PO, fatigue (+14) et ne dépasse jamais le POTENTIEL du gladiateur. Les jeunes progressent bien plus vite ; après 30 ans, les traits physiques déclinent chaque saison.',
      'Le repos enlève 30 de fatigue. Un gladiateur fatigué perd de la forme, donc de l’efficacité en combat.',
    ],
  },
  taverne: {
    titre: 'La Taverne',
    texte: [
      'Les rumeurs pointent vers des affaires du marché. La tournée générale (+4 moral) détend le vestiaire.',
      'Le tableau des chances d’apparition montre la probabilité de voir chaque palier (SS, S, A…) parmi les agents libres de la prochaine fenêtre de transfert. Votre réputation améliore ces chances.',
    ],
  },
  banque: {
    titre: 'La Banque',
    texte: [
      'Revenus : primes de match, prix de fin de saison, recettes hebdomadaires (indexées sur la réputation), ventes de gladiateurs.',
      'Dépenses : salaires hebdomadaires, entraînements, guérisseur, transferts.',
      'Un gladiateur payé sous ses exigences perd du moral et performe moins (jusqu’à −10 %). Bien payé : léger bonus.',
      '4 semaines de trésorerie négative = départ forcé d’un gladiateur. La faillite met fin à la partie.',
    ],
  },
  infirmerie: {
    titre: 'L’Infirmerie',
    texte: [
      'Les blessures surviennent surtout après un K.O. en match officiel (30 %) et durent 1 à 5 semaines.',
      'Le guérisseur réduit la convalescence d’une semaine par paiement (90 PO).',
    ],
  },
  equipe: {
    titre: 'Votre équipe',
    texte: [
      'Touchez une carte pour la fiche complète : ajustez le salaire (baisser = moral en chute), libérez un gladiateur (indemnité de 4 semaines de salaire).',
      'Palier (note globale) : D < 55 ≤ C < 65 ≤ B < 75 ≤ A < 85 ≤ S < 93 ≤ SS.',
      'Les TALENTS CACHÉS (jusqu’à 2 par gladiateur, plus fréquents aux hauts paliers) se découvrent quand ils se déclenchent dans VOS matchs : surveillez les annonces dorées en combat !',
    ],
  },
  match: {
    titre: 'Le combat',
    texte: [
      '1. Choisissez 3 titulaires (+2 remplaçants pour le moral).',
      '2. PLACEZ-LES sur votre moitié d’arène : colonne AVANT pour les cogneurs, CENTRE pour les tireurs (roublard/lancier), ARRIÈRE pour les mages. Le placement compte : un mage en première ligne meurt vite !',
      '3. Le combat se déroule tout seul, mais vous pouvez changer la consigne en direct (agressif, défensif, magie), toucher un ennemi pour le cibler en priorité, ou « Passer » pour un résultat instantané.',
      'À distance : les tireurs harcèlent avec couteaux/javelots (dégâts liés à la Fourberie) — mais les projectiles sont bien plus faciles à BLOQUER (Intelligence) que les coups au corps à corps.',
    ],
  },
};
