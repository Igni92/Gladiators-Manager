# Brief artistique — assets 3D pré-rendus « Gladiators Manager »

Univers : fantasy gladiateurs, cartoon soigné mais PAS enfantin (référence :
Clash Royale pour la lisibilité, Darkest Dungeon adouci pour l'ambiance).
Personnages trapus type "chibi héroïque" : grosses épaules, grosses mains,
tête ~1/3 de la hauteur, jambes courtes. Couleurs riches et contrastées,
ombres marquées, rim light chaud (torches d'arène).

## Contraintes techniques (OBLIGATOIRES)
- Blender 4.2 headless : `/opt/blender/blender -b -P script.py`
- Moteur : Cycles CPU (Eevee indisponible sans GPU), samples 24–48 + denoise,
  film transparent (alpha) pour tous les sprites.
- Sortie dans `/home/user/Gladiators-Manager/public/assets/` (PNG).
- Spritesheets assemblées avec Pillow (`/usr/local/bin/python3 -m pip install pillow`).
- Échelle : personnage debout ≈ 85 % de la hauteur de sa cellule.

## Livrables et conventions de nommage (CONTRAT — ne pas dévier)

### 1. Sprites de combat — `public/assets/sprites/{classe}.png` + `{classe}.json`
Classes (6) : `colosse`, `bretteur`, `roublard`, `lancier`, `mage`, `berserker`.
- Caméra : orthographique, élévation ~55° (vue de dessus inclinée, lisible),
  personnage centré, ombre portée au sol incluse (shadow catcher → alpha).
- Cellule : 128×128 px.
- 4 directions rendues en tournant le personnage : S (face caméra), E, N (dos), W.
- Animations (poses scriptées par rotation des membres, pas d'armature nécessaire :
  hiérarchie d'empties pour épaules/coudes/hanches/cou) :
  - `idle` : 2 frames (respiration : buste qui monte/descend légèrement)
  - `walk` : 4 frames (cycle bras/jambes opposés)
  - `attack` : 4 frames (anticipation → frappe → follow-through)
  - `hit` : 1 frame (recul, buste penché en arrière)
  - `death` : 2 frames (chute → au sol)
  - `cast` : 4 frames (UNIQUEMENT pour `mage` : bras levés, orbe qui grossit)
- Layout du PNG : 1 ligne par (direction × animation), frames en colonnes.
- JSON : `{ "cell": 128, "directions": ["S","E","N","W"], "animations": { "idle": {"row_S":0,"row_E":1,...,"frames":2}, ... } }`
  → format exact : `{ "cell": number, "rows": [ {"dir":"S","anim":"idle","row":0,"frames":2}, ... ] }`

### 2. Portraits — `public/assets/portraits/{classe}_{0|1|2}.png`
- 512×512, buste 3/4 (caméra légèrement au-dessus des yeux, regard caméra),
  fond transparent, éclairage dramatique 3 points (key chaud, rim orange torche).
- 3 variantes par classe : casque/coiffure différents + couleur d'armure différente.
- 18 fichiers au total.

### 3. Identité visuelle des 6 classes
- `colosse` : géant massif, armure lourde sombre + cuivre, grande masse d'armes,
  casque fermé à cornes courtes. Palette : bronze/brun/acier.
- `bretteur` : gladiateur classique équilibré, glaive + grand bouclier rond,
  casque à cimier (crête rouge). Palette : acier/rouge/or.
- `roublard` : silhouette fine, capuche/foulard, deux dagues, cuir sombre.
  Palette : noir/vert sombre/argent.
- `lancier` : élancé, lance longue + petit bouclier, casque à plumes hautes.
  Palette : bleu/blanc/or.
- `mage` : robe longue avec capuche ou chapeau, bâton avec cristal lumineux
  (émissif violet/cyan), runes émissives. Palette : violet/cyan/or sombre.
- `berserker` : torse nu musculeux, peintures de guerre, double hache,
  cheveux/barbe sauvages. Palette : peau/rouge sang/fourrure.

### 4. Bâtiments de la ville — `public/assets/buildings/{nom}.png`
Caméra orthographique ~50° d'élévation, rotation 30–40° (3/4 vue de dessus),
ombre au sol, alpha. 512×512 chacun. Style : fantasy méditerranéenne (pierre
ocre, toits de tuiles, bois sombre), chaque bâtiment immédiatement identifiable :
- `arene` : mini colisée elliptique, gradins, oriflammes rouges. (256 ne suffit pas : 768×768 pour celui-ci, c'est le bâtiment vedette)
- `marche` : étals colorés sous auvents, enseigne « casque à vendre », cage dorée.
- `caserne` : bâtiment trapu + cour avec mannequins d'entraînement, râteliers d'armes.
- `taverne` : maison à colombages, enseigne chope, lanternes chaudes.
- `banque` : façade à colonnes, fronton, coffre/pièces d'or devant.
- `infirmerie` : bâtiment blanc, croix/serpent d'Asclépios, tentes.
- décor : `fontaine.png` (256), `arbre_a.png`, `arbre_b.png` (256, cyprès/olivier), `statue.png` (256, gladiateur de pierre).

### 5. Arène de combat — `public/assets/arena/arena_bg.png`
- 1024×1024, vue de DESSUS quasi verticale (~70–80°) de la piste ovale :
  sable avec traces, bordure de pierre, premier rang de gradins avec foule
  suggérée (cubes colorés low-poly), 4 torches aux coins. PAS d'alpha (fond plein).
- La zone jouable (sable) doit couvrir le centre, ellipse inscrite ~85 %.

### 6. Écran titre + icône — `public/assets/ui/`
- `title_hero.png` : 1024×1024, composition héroïque : 3 gladiateurs (bretteur
  au centre en pose victorieuse, colosse et mage derrière) sur fond d'arène
  au coucher de soleil, alpha ou fond intégré (fond intégré OK).
- `icon.png` : 1024×1024 fond PLEIN (pas d'alpha) : casque de gladiateur à
  cimier rouge en gros plan 3/4, fond dégradé sombre radial, lisible en petit.

## Méthode de travail exigée
1. Écrire un module python réutilisable (personnage paramétrique : proportions,
   tête, casques, armes, matériaux) + scripts par lot.
2. ITÉRER VISUELLEMENT : rendre UNE frame de test, l'ouvrir avec l'outil Read
   (les PNG se lisent comme images), corriger pose/cadrage/éclairage, et
   seulement ensuite lancer le lot complet.
3. Vérifier chaque spritesheet finale visuellement (la lire en image).
4. Budget temps de rendu : viser < 60 min de rendu total (résolutions/samples bas).
5. Scripts conservés dans `tools/blender/` (rejouables), sorties intermédiaires
   dans `tools/blender/out/` (gitignoré), assets finaux dans `public/assets/`.
