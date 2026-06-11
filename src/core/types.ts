/** Types centraux du jeu. */

export type Tier = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

export type ClassId = 'colosse' | 'bretteur' | 'roublard' | 'lancier' | 'mage' | 'berserker';

export type TraitId = 'force' | 'vitesse' | 'intelligence' | 'fourberie' | 'esquive' | 'magie';

export type Personnalite = 'fidele' | 'cupide' | 'fier' | 'jovial' | 'anxieux';

/** Talents cachés : se révèlent quand ils se déclenchent dans VOS matchs. */
export type TalentId =
  | 'fumigene'      // après une esquive : invincible 0,9 s
  | 'dash'          // après une esquive : se téléporte dans le dos de l'attaquant
  | 'riposte'       // après un blocage : contre-attaque immédiate
  | 'rage'          // sous 35 % PV : dégâts +20 %, vitesse +10 %
  | 'carapace'      // sous 35 % PV : garde renforcée
  | 'vampirisme'    // ses coups physiques rendent 16 % des dégâts en PV
  | 'executeur'     // +30 % de dégâts sur les cibles sous 30 % PV
  | 'premiersang'   // +40 % de dégâts pendant les 5 premières secondes
  | 'longueportee'  // portée +30 % et dégâts à distance +15 %
  | 'secondevie';   // survit au premier coup fatal (1 PV, invincible 1 s)

export interface Traits {
  force: number;
  vitesse: number;
  intelligence: number;
  fourberie: number;
  esquive: number;
  magie: number;
}

export interface Blessure {
  type: string;
  /** semaines restantes avant guérison */
  semaines: number;
}

export interface StatsCarriere {
  combats: number;
  victoires: number;
  elims: number;
  degats: number;
}

export interface Gladiator {
  id: number;
  nom: string;
  classe: ClassId;
  /** variante de portrait 0..2 */
  variante: number;
  /** décalage de teinte (degrés) pour différencier les sprites */
  teinte: number;
  traits: Traits;
  /** plafond de note globale atteignable par l'entraînement */
  potentiel: number;
  age: number;
  /** 0..100 */
  moral: number;
  /** 0..100 — forme physique */
  forme: number;
  /** 0..100 — fatigue accumulée */
  fatigue: number;
  blessure: Blessure | null;
  personnalite: Personnalite;
  /** salaire hebdomadaire en PO */
  salaire: number;
  equipeId: number;
  stats: StatsCarriere;
  /** talents cachés (révélés au fil des combats) */
  talents: TalentId[];
  /** talents déjà découverts par le manager */
  talentsConnus: TalentId[];
}

export interface Team {
  id: number;
  nom: string;
  /** couleur principale (CSS) */
  couleur: string;
  tresorerie: number;
  /** 0..100 — débloque l'international à un seuil */
  reputation: number;
  gladiateurIds: number[];
  estJoueur: boolean;
  /** 0 = D1, 1 = D2, 2 = D3, -1 = équipe étrangère (international) */
  division: number;
  /** semaines consécutives en trésorerie négative (joueur) */
  semainesDettes: number;
}

export type CompetitionId = 'ligue' | 'coupe' | 'international' | 'amical';

export interface MatchResult {
  saison: number;
  semaine: number;
  competition: CompetitionId;
  domId: number;
  extId: number;
  scoreDom: number;
  scoreExt: number;
}

/** Une journée de championnat. */
export interface Journee {
  semaine: number;
  matchs: [number, number][];
  joue: boolean;
}

export interface LigueState {
  /** 0..2 */
  division: number;
  equipes: number[];
  journees: Journee[];
}

export interface CoupeTour {
  semaine: number;
  /** paires d'équipes ; -1 = à déterminer */
  matchs: [number, number][];
  joue: boolean;
}

export interface CoupeState {
  nom: string;
  competition: CompetitionId;
  /** équipes encore en lice après le dernier tour joué */
  qualifies: number[];
  tours: CoupeTour[];
  /** index du prochain tour à jouer */
  tourActuel: number;
  termine: boolean;
}

export interface OffreRecue {
  id: number;
  gladiateurId: number;
  equipeId: number;
  prix: number;
  /** semaine d'expiration */
  expire: number;
  /** nombre de relances déjà faites par le joueur */
  relances: number;
  /** budget max caché de l'acheteur (négociation) */
  maxCache: number;
}

export interface AnnonceMarche {
  gladiateurId: number;
  /** prix demandé par le vendeur */
  prixDemande: number;
  /** id équipe vendeuse, -1 = agent libre */
  vendeurId: number;
  /** nombre de négociations tentées par le joueur sur cette annonce */
  tentatives: number;
}

export interface Rumeur {
  texte: string;
  /** id de gladiateur du marché concerné, -1 sinon */
  gladiateurId: number;
}

export interface LigneFinance {
  saison: number;
  semaine: number;
  libelle: string;
  montant: number;
}

export interface EntrainementChoix {
  /** trait entraîné ou 'repos' */
  [gladiateurId: number]: TraitId | 'repos';
}

export type PhaseSemaine =
  | { type: 'marche' }
  | { type: 'ligue'; journee: number }
  | { type: 'coupe'; tour: number }
  | { type: 'international'; tour: number }
  | { type: 'libre' };

export interface GameState {
  version: number;
  seed: number;
  /** graine RNG courante (mutée à chaque tirage sauvegardé) */
  rngState: number;
  saison: number;
  semaine: number;
  equipeJoueurId: number;
  equipes: Team[];
  gladiateurs: { [id: number]: Gladiator };
  prochainId: number;
  ligues: LigueState[];
  coupe: CoupeState | null;
  international: CoupeState | null;
  resultats: MatchResult[];
  marche: AnnonceMarche[];
  offresRecues: OffreRecue[];
  prochainOffreId: number;
  rumeurs: Rumeur[];
  finances: LigneFinance[];
  entrainement: EntrainementChoix;
  /** match du joueur cette semaine, déjà joué ? */
  matchJoue: boolean;
  /** historique de trésorerie par semaine (pour le graphe de la banque) */
  historiqueTresorerie: number[];
  /** dernier placement utilisé (slots 0-8 par gladiateur) */
  placements: { [gladiateurId: number]: number };
  /** réputation requise déjà annoncée ? petits flags d'UX */
  flags: { [k: string]: boolean };
  gameOver: boolean;
}
