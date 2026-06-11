/** Point d'entrée : chargement des assets, enregistrement des écrans, démarrage. */

import './ui/tokens.css';
import './style.css';
import { assets } from './render/assets';
import { jeu } from './ui/jeu';
import { rendreTitre } from './ui/ecrans/titre';
import { rendreVille } from './ui/ecrans/ville';
import { rendreArene } from './ui/ecrans/arene';
import { rendreMarche } from './ui/ecrans/marche';
import { rendreCaserne } from './ui/ecrans/caserne';
import { rendreTaverne } from './ui/ecrans/taverne';
import { rendreBanque } from './ui/ecrans/banque';
import { rendreInfirmerie } from './ui/ecrans/infirmerie';
import { rendreEquipe } from './ui/ecrans/equipe';
import { rendreMatch } from './ui/ecrans/match';
import { rendreMonde } from './ui/ecrans/monde';
import { el } from './ui/dom';

jeu.enregistrer('titre', () => rendreTitre());
jeu.enregistrer('ville', () => rendreVille());
jeu.enregistrer('arene', () => rendreArene());
jeu.enregistrer('marche', (p) => rendreMarche(p));
jeu.enregistrer('caserne', () => rendreCaserne());
jeu.enregistrer('taverne', () => rendreTaverne());
jeu.enregistrer('banque', () => rendreBanque());
jeu.enregistrer('infirmerie', () => rendreInfirmerie());
jeu.enregistrer('equipe', () => rendreEquipe());
jeu.enregistrer('match', (p) => rendreMatch(p));
jeu.enregistrer('monde', () => rendreMonde());

async function demarrer(): Promise<void> {
  const racine = jeu.racine();
  racine.innerHTML = '';
  racine.append(
    el('div', { class: 'ecran', style: 'align-items:center;justify-content:center;display:flex;' },
      el('div', { style: 'text-align:center;color:var(--or-clair);font-size:18px;font-weight:800;' }, '⚔️ Chargement de l’arène…')),
  );
  await assets.charger();
  jeu.aller('titre');
}

void demarrer();
