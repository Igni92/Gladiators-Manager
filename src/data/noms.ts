/** Données de génération : noms, épithètes, équipes, blessures, rumeurs. */

import type { ClassId, Personnalite, TraitId } from '../core/types';

export const PRENOMS = [
  'Karg', 'Brak', 'Ulric', 'Thorvald', 'Maelis', 'Kaelen', 'Drogan', 'Sylvio',
  'Ragna', 'Astrid', 'Vex', 'Orin', 'Baldur', 'Cassia', 'Darius', 'Elric',
  'Fenris', 'Gorm', 'Hilda', 'Isolde', 'Jorah', 'Kessandra', 'Lazlo', 'Morgane',
  'Naïm', 'Octavia', 'Petrus', 'Quintus', 'Roxane', 'Sigrid', 'Tibor', 'Una',
  'Varek', 'Wilhelmine', 'Xandor', 'Ysolt', 'Zadok', 'Almaric', 'Brunhilde',
  'Corvus', 'Demetria', 'Edern', 'Faustine', 'Galaad', 'Hecate', 'Ivar',
  'Jormund', 'Kira', 'Lothar', 'Melisande', 'Nero', 'Ophelia', 'Pyrrhus',
  'Rurik', 'Selene', 'Tancrede', 'Urszula', 'Vidar', 'Wren', 'Yrsa', 'Zora',
  'Ashka', 'Boris', 'Cyrielle', 'Dag', 'Enora', 'Falko', 'Gwenn', 'Hadrien',
];

export const EPITHETES = [
  'le Sanglant', 'Brisefer', 'la Tempête', 'l’Ombre', 'Coeur-de-Pierre',
  'le Rusé', 'Troisdoigts', 'la Vipère', 'le Colossal', 'Manchefroide',
  'l’Éclair', 'Fendcrâne', 'la Furie', 'le Pieux', 'Oeil-de-Lynx',
  'le Taciturne', 'Grandepoigne', 'la Lame', 'le Boucher', 'Pâlemort',
  'le Renard', 'Tonnerre', 'la Cendre', 'le Loup', 'Brisetombe',
  'l’Insaisissable', 'Ventrefer', 'la Comète', 'le Magnifique', 'Sans-Peur',
  'le Cobra', 'Hurleciel', 'la Faucheuse', 'le Doux', 'Rougeoyant',
  'le Spectre', 'Briseboucliers', 'la Murène', 'le Bâtard', 'Yeux-d’Or',
];

export const NOMS_EQUIPES = [
  'Les Lions de Bronze', 'La Meute Écarlate', 'Les Corbeaux d’Onyx',
  'Le Pacte du Serpent', 'Les Boucliers d’Ivoire', 'La Horde Cendrée',
  'Les Spectres du Nord', 'L’Ordre du Griffon', 'Les Chacals Dorés',
  'La Fureur des Sables', 'Les Marteaux de Fer', 'Le Cercle des Brumes',
  'Les Taureaux Noirs', 'La Garde Pourpre', 'Les Vipères de Jade',
  'L’Aile de Cuivre', 'Les Loups de Givre', 'La Couronne Brisée',
  'Les Scorpions Rouges', 'Le Phalange d’Émeraude', 'Les Crocs d’Argent',
  'La Légion des Ronces', 'Les Aigles du Couchant', 'Le Serment des Cendres',
];

export const NOMS_EQUIPES_INTL = [
  'Dynastie du Lotus Noir', 'Les Titans d’Hyperborée', 'Le Kraken Abyssal',
  'Les Sultans de l’Aube', 'La Cohorte Éternelle', 'Les Walkyries d’Acier',
  'L’Empire du Soleil Mort', 'Les Princes Écorchés',
];

export const COULEURS_EQUIPES = [
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085',
  '#f1c40f', '#7f8c8d', '#e84393', '#00cec9', '#6c5ce7', '#e17055',
  '#74b816', '#1e3799', '#b71540', '#38ada9', '#e58e26', '#8c7ae6',
  '#487eb0', '#44bd32', '#c23616', '#353b48', '#9c88ff', '#fbc531',
];

export const CLASSES: ClassId[] = ['colosse', 'bretteur', 'roublard', 'lancier', 'mage', 'berserker'];

export const NOMS_CLASSES: Record<ClassId, string> = {
  colosse: 'Colosse',
  bretteur: 'Bretteur',
  roublard: 'Roublard',
  lancier: 'Lancier',
  mage: 'Mage',
  berserker: 'Berserker',
};

export const NOMS_TRAITS: Record<TraitId, string> = {
  force: 'Force',
  vitesse: 'Vitesse',
  intelligence: 'Intelligence',
  fourberie: 'Fourberie',
  esquive: 'Esquive',
  magie: 'Magie',
};

export const ABREV_TRAITS: Record<TraitId, string> = {
  force: 'FOR',
  vitesse: 'VIT',
  intelligence: 'INT',
  fourberie: 'FOU',
  esquive: 'ESQ',
  magie: 'MAG',
};

export const NOMS_PERSONNALITES: Record<Personnalite, string> = {
  fidele: 'Fidèle',
  cupide: 'Cupide',
  fier: 'Fier',
  jovial: 'Jovial',
  anxieux: 'Anxieux',
};

export const DESC_PERSONNALITES: Record<Personnalite, string> = {
  fidele: 'Accepte un salaire modeste, moral stable.',
  cupide: 'Exige un gros salaire, très sensible à la paye.',
  fier: 'Veut être titulaire et bien payé.',
  jovial: 'Bon moral naturel, remonte le vestiaire.',
  anxieux: 'Moral en dents de scie, sensible aux défaites.',
};

export const TYPES_BLESSURES = [
  'Entorse de la cheville', 'Fracture du poignet', 'Plaie profonde',
  'Côtes fêlées', 'Commotion', 'Épaule démise', 'Brûlure magique',
  'Déchirure musculaire', 'Genou tordu', 'Morsure de fauve',
];

export const RUMEURS_MARCHE = [
  'Un marchand jure que {nom} ({palier}) cherche une nouvelle écurie.',
  'On murmure que {nom} serait à vendre pour une bouchée de pain.',
  'Le crieur public vante les exploits de {nom}, {classe} de palier {palier}.',
  '{nom} aurait claqué la porte de son ancienne écurie. Affaire à saisir ?',
  'Un parieur ruiné affirme que {nom} vaut le triple de son prix.',
];

export const RUMEURS_AMBIANCE = [
  'La taverne bruisse de paris sur la prochaine journée de ligue.',
  'Un ménestrel chante les louanges de votre écurie. La réputation monte.',
  'Le forgeron du quartier propose des rabais aux écuries titrées.',
  'On raconte qu’un tournoi international se prépare au-delà des mers.',
  'Deux recruteurs étrangers ont été vus près de l’arène.',
  'Le tavernier garde une cuvée spéciale pour fêter votre prochain titre.',
];

export const NOMS_DIVISIONS = ['Ligue d’Or', 'Ligue d’Argent', 'Ligue de Bronze'];
