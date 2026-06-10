/**
 * ÉQUILIBRAGE — toutes les constantes du jeu, documentées.
 * Ces valeurs sont validées par la simulation headless (tools/sim/simulate.ts) :
 *  - une écurie jouée « normalement » (alignements sensés, entraînement, soins)
 *    ne fait pas faillite sur 5 saisons ;
 *  - une écurie inactive (forfaits, aucun entraînement) ne s'enrichit pas.
 * Voir EQUILIBRAGE.md pour la justification des ordres de grandeur.
 */

import type { Tier } from '../core/types';

export const BALANCE = {
  /** ---------- PALIERS ---------- */
  /** bornes inférieures de note globale par palier (borne sup. du précédent - 1) */
  paliers: { D: 0, C: 55, B: 65, A: 75, S: 85, SS: 93 } as Record<Tier, number>,

  /** ---------- SALAIRES / SATISFACTION ---------- */
  /**
   * Salaire hebdomadaire attendu en PO selon la note globale :
   *   attendu = SAL_BASE * exp((ovr - 40) / SAL_ECHELLE)
   * → ovr 50 ≈ 13 PO, 60 ≈ 28, 70 ≈ 60, 80 ≈ 129, 90 ≈ 278, 99 ≈ 555.
   * Les très bons gladiateurs coûtent exponentiellement plus cher : garder un
   * effectif S/SS exige les primes des grandes compétitions.
   */
  SAL_BASE: 6,
  SAL_ECHELLE: 13,
  /** facteur d'exigence salariale par personnalité (multiplie le salaire attendu) */
  exigenceSalaire: { fidele: 0.85, cupide: 1.25, fier: 1.1, jovial: 0.95, anxieux: 1.0 },
  /**
   * Satisfaction salariale s = clamp(salaire / attendu, 0.5, 1.5).
   * Performance en combat : ×(0.92 + 0.10 × s) → sous-payé ≈ ×0.97, bien payé ≈ ×1.07.
   * Dérive de moral hebdo : (s - 1) × 6 points (borné ±4), cupide ×1.6, fidèle ×0.6.
   */
  PERF_SAL_BASE: 0.92,
  PERF_SAL_PENTE: 0.1,
  MORAL_SAL_PENTE: 6,
  MORAL_SAL_MAX: 4,

  /** ---------- ÉCONOMIE ---------- */
  /** trésorerie de départ du joueur */
  TRESORERIE_DEPART: 2500,
  /** revenu hebdo passif (petites recettes d'écurie) : base + pente × réputation */
  REVENU_PASSIF_BASE: 60,
  REVENU_PASSIF_REPUT: 1.2,
  /** primes de match de ligue par division [D1, D2, D3] : victoire / nul / défaite */
  primesLigue: [
    { v: 650, n: 320, d: 140 },
    { v: 300, n: 150, d: 70 },
    { v: 160, n: 80, d: 40 },
  ],
  /** prime de match amical (victoire / défaite) */
  PRIME_AMICAL_V: 45,
  PRIME_AMICAL_D: 15,
  /** prix de fin de saison de ligue par division, du 1er au 8e */
  prixSaison: [
    [6000, 4200, 3000, 2200, 1600, 1200, 900, 700],
    [2600, 1800, 1300, 950, 700, 520, 400, 320],
    [1500, 1100, 800, 620, 500, 420, 360, 320],
  ],
  /** coupe : prime par victoire de tour (8e, quart, demi, finale) + bonus vainqueur */
  primesCoupe: [250, 500, 1000, 2200],
  BONUS_VAINQUEUR_COUPE: 1500,
  /** international : prime par victoire de tour (quart, demi, finale) + bonus vainqueur */
  primesInternational: [2500, 5000, 11000],
  BONUS_VAINQUEUR_INTL: 9000,
  /** réputation minimale pour être invité au tournoi international */
  REPUTATION_INTL: 60,

  /** ---------- VALEUR DE TRANSFERT ---------- */
  /**
   * valeur ≈ salaireAttendu(ovr) × VAL_MULT × facteurÂge × facteurPotentiel.
   * facteurÂge : pic à 23-27 ans, décote forte après 31.
   * Un B de 25 ans (ovr 70) vaut ≈ 80 × 26 ≈ 2100 PO.
   */
  VAL_MULT: 26,

  /** ---------- ENTRAÎNEMENT ---------- */
  /** coût d'une semaine d'entraînement = COUT_ENTR_BASE + ovr × COUT_ENTR_PENTE */
  COUT_ENTR_BASE: 10,
  COUT_ENTR_PENTE: 0.3,
  /** gain de trait par session : base × facteurÂge × facteurPotentiel (0 si plafonné) */
  GAIN_ENTR_BASE: 1.1,
  /** fatigue : +X par entraînement, +Y par combat, -Z par semaine de repos */
  FATIGUE_ENTRAINEMENT: 14,
  FATIGUE_COMBAT: 18,
  RECUP_REPOS: 30,
  RECUP_PASSIVE: 12,

  /** ---------- ÂGE ---------- */
  AGE_MIN: 17,
  AGE_PIC_DEBUT: 23,
  AGE_PIC_FIN: 28,
  AGE_RETRAITE: 36,
  /** déclin annuel moyen des traits physiques après 30 ans */
  DECLIN_ANNUEL: 1.6,

  /** ---------- BLESSURES ---------- */
  /** probabilité de blessure quand un gladiateur tombe K.O. en match officiel */
  P_BLESSURE_KO: 0.3,
  /** probabilité de blessure pour un participant non K.O. */
  P_BLESSURE_PARTICIPANT: 0.05,
  /** coût du guérisseur pour réduire la convalescence d'une semaine */
  COUT_GUERISSEUR: 90,

  /** ---------- MORAL ---------- */
  MORAL_VICTOIRE: 6,
  MORAL_DEFAITE: -4,
  MORAL_TITULAIRE: 1,
  MORAL_REMPLACANT: -2,
  /** retour vers 50 chaque semaine (inertie forte : évite la spirale de défaites) */
  MORAL_INERTIE: 0.16,

  /** ---------- COMBAT ---------- */
  /** durée max d'un combat en secondes (au-delà : décision aux PV restants) */
  COMBAT_DUREE_MAX: 95,
  TICK: 1 / 30,
  /** PV = PV_BASE + force × PV_FORCE + ovr × PV_OVR (× modificateur de classe) */
  PV_BASE: 110,
  PV_FORCE: 2.1,
  PV_OVR: 0.9,
  /** dégâts mêlée = DEG_BASE + force × DEG_FORCE (× arme de classe, × état) */
  DEG_BASE: 7,
  DEG_FORCE: 0.32,
  /** vitesse de déplacement (unités/s) = DEPL_BASE + vitesse × DEPL_PENTE */
  DEPL_BASE: 52,
  DEPL_PENTE: 1.05,
  /** délai entre attaques (s) = max(0.8, ATT_CD_BASE - vitesse × ATT_CD_PENTE) */
  ATT_CD_BASE: 2.0,
  ATT_CD_PENTE: 0.009,
  /** esquive : P = esquive × 0.0045 (cap 0.38) ; fourberie : crit = fourberie × 0.0035 (+ dos ×1.6), dégâts crit ×1.8 */
  ESQ_PENTE: 0.0045,
  ESQ_CAP: 0.38,
  CRIT_PENTE: 0.0035,
  CRIT_MULT: 1.8,
  /** intelligence : réduit le temps de décision et donne un bonus de garde (réduction de dégâts subis) */
  GARDE_PENTE: 0.0022,
  /** magie : seuil pour être lanceur de sorts */
  SEUIL_MAGE: 60,
  /** boule de feu : dégâts = 18 + magie × 0.5, cd 4,5 s, portée 320 */
  FEU_BASE: 18,
  FEU_MAGIE: 0.5,
  FEU_CD: 4.5,
  /** nova de zone : dégâts = 14 + magie × 0.34, rayon 95, cd 10 s */
  NOVA_BASE: 14,
  NOVA_MAGIE: 0.34,
  NOVA_CD: 10,
  /** soin : rend 16 + magie × 0.42 PV à l'allié le plus blessé, cd 9 s */
  SOIN_BASE: 16,
  SOIN_MAGIE: 0.42,
  SOIN_CD: 9,
  /** consignes : agressif = dégâts ×1.15 / esquive-garde ×0.85 ; défensif = inverse */
  CONSIGNE_BONUS: 1.15,
  CONSIGNE_MALUS: 0.85,

  /** ---------- MARCHÉ ---------- */
  /** taille du vivier d'annonces pendant une fenêtre de transfert */
  TAILLE_MARCHE: 9,
  /** probabilité hebdo (fenêtre ouverte) qu'une équipe IA fasse une offre sur un de mes gladiateurs */
  P_OFFRE_IA: 0.55,
  /** fourchette des offres IA en multiple de la valeur estimée */
  OFFRE_IA_MIN: 0.75,
  OFFRE_IA_MAX: 1.3,

  /** ---------- RÉPUTATION ---------- */
  REPUT_VICTOIRE_LIGUE: [1.0, 0.55, 0.3],
  REPUT_DEFAITE: -0.25,
  REPUT_COUPE_TOUR: 1.5,
  REPUT_TITRE_LIGUE: [8, 5, 3],
  REPUT_TITRE_COUPE: 7,
  REPUT_TITRE_INTL: 15,

  /** ---------- DETTES ---------- */
  /** semaines consécutives de trésorerie négative avant départs forcés */
  SEMAINES_DETTE_MAX: 4,
} as const;

/** Note globale → palier. */
export function tierDe(ovr: number): Tier {
  if (ovr >= BALANCE.paliers.SS) return 'SS';
  if (ovr >= BALANCE.paliers.S) return 'S';
  if (ovr >= BALANCE.paliers.A) return 'A';
  if (ovr >= BALANCE.paliers.B) return 'B';
  if (ovr >= BALANCE.paliers.C) return 'C';
  return 'D';
}

export const TIER_ORDRE: Tier[] = ['D', 'C', 'B', 'A', 'S', 'SS'];

export const TIER_COULEURS: Record<Tier, { fond: string; texte: string }> = {
  D: { fond: 'linear-gradient(160deg,#6b7280,#374151)', texte: '#e5e7eb' },
  C: { fond: 'linear-gradient(160deg,#b08d57,#7c5a32)', texte: '#fff7e6' },
  B: { fond: 'linear-gradient(160deg,#cbd5e1,#64748b)', texte: '#0f172a' },
  A: { fond: 'linear-gradient(160deg,#fde047,#b45309)', texte: '#3b2300' },
  S: { fond: 'linear-gradient(160deg,#f97316,#7f1d1d)', texte: '#fff1e6' },
  SS: { fond: 'linear-gradient(150deg,#a78bfa,#22d3ee,#f472b6)', texte: '#1e1b4b' },
};
