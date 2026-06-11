# BRIEF v3 — Refonte « Pixar fantasy » de Gladiators Manager

Direction : cartoon **Disney/Pixar** (Encanto, Raiponce) — formes douces et
arrondies, GRANDS yeux expressifs (iris coloré + reflet blanc), palette
saturée harmonieuse, éclairage doux à 3 points avec rebond chaud. Fantasy RPG
assumée. Cible mobile : lisibilité maximale en petit.

## RACES (6) — identités visuelles OBLIGATOIRES
- `humain`   : référence actuelle, peaux variées.
- `elfe`     : fin, oreilles pointues longues (cônes), yeux en amande, cheveux longs/tresse. Peau claire ou dorée.
- `nain`     : trapu (large, jambes courtes), GROSSE barbe tressée (f : tresses + barbe courte ou taches de rousseur), nez rond.
- `orc`      : massif, peau verte, mâchoire large avec 2 défenses vers le haut, sourcils lourds.
- `gobelin`  : petit (~75 % de la taille), peau vert-jaune, très grandes oreilles latérales, grand sourire malicieux.
- `drakeide` : écailles (peau texturée rouge/bleue), museau court, 2 cornes, yeux dorés fendus, queue courte.

Genres `m` / `f` : silhouette (épaules/hanches), cheveux/coiffes, cils marqués
pour `f`, barbes pour `m` (nain surtout). Pas de caricature.

## CORPULENCES (3) — paramétriques
0 = mince (×0.88 largeur), 1 = moyen (×1.0), 2 = massif (×1.18). La classe
impose souvent la sienne (colosse → 2, roublard → 0) mais le système doit
accepter toute combinaison.

## CONTRAT AGENT 1 — Personnages (tools/blender/ + public/assets/ + assets3d/)
Tu possèdes : `tools/blender/*` (gmlib.py & co), `public/assets/sprites/`,
`public/assets/portraits/`, `public/assets/ui/title_hero.png`, `assets3d/`.
NE TOUCHE PAS à src/, tests/, public/assets/{buildings,arena,icons,monde}. AUCUN commit git.

PRIORITÉS (dans l'ordre, chaque étape utilisable seule) :
1. **gmlib v3** : faire évoluer build_character(classe, variant) →
   `build_character(classe, race='humain', genre='m', corpulence=1, variant=0)`
   SANS casser poses/joints existants (apply_pose/get_pose inchangés).
   Yeux Pixar (blanc + iris coloré + pupille + reflet), bouche souriante,
   features raciales ci-dessus. Itère VISUELLEMENT (rends 512px, ouvre avec
   Read, juge sévèrement, corrige) sur bretteur humain m, elfe f, nain m,
   orc m, gobelin m, drakeide f AVANT tout lot.
2. **Sprites de combat** : pour CHAQUE (race × classe) = 36 spritesheets,
   genre m, corpulence par classe (colosse/berserker 2, roublard/gobelin 0,
   sinon 1). MÊME format atlas qu'actuellement (cell 160, 4 directions S/E/N/W,
   animations idle2/walk4/attack4/hit1/death2 + cast4 pour mage) :
   `public/assets/sprites/{race}_{classe}.png` + `.json` (même schéma JSON).
   Les anciens fichiers `{classe}.png` restent en place (fallback du jeu).
3. **Portraits** : `public/assets/portraits/{race}_{genre}_{classe}.png`,
   512px, buste 3/4, alpha, éclairage dramatique doux = 72 fichiers.
4. **Écran titre** : re-rendre title_hero.png avec le nouveau style
   (bretteur humain + colosse orc + mage elfe f).
5. **Livrables 3D** dans `assets3d/` :
   - `fbx/{asset}_lod0|1|2.fbx` : têtes (6 races × 2 genres = 12), corps
     (6 races × 3 corpulences = 18), armures (6 classes), armes (10+),
     accessoires (6+). LOD0 ≤ 20k tris, LOD1 ~8k, LOD2 ~3k (Decimate).
   - Squelette : génère une VRAIE armature programmatiquement depuis la
     hiérarchie d'empties (un bone par articulation : pelvis/spine/neck/
     shoulder_L/R/elbow_L/R/hip_L/R/knee_L/R), meshes skinnés rigide
     (vertex group = 100 % sur leur bone) avant export FBX.
   - `textures/{asset}_albedo.png` (bake Cycles, Smart UV Project, 512),
     `_normal.png` (bake), `_roughness.png` et `_metallic.png` (générés en
     aplat depuis les valeurs matériaux via PIL — nos matériaux sont uniformes).
   - `RIGGING.md` : hiérarchie des bones, conventions de nommage, comment
     mixer tête/corps/armure dans un moteur, budgets polys mesurés.
6. Vérifie chaque spritesheet/planche assemblée en l'ouvrant en image.

## CONTRAT AGENT 2 — Carte du monde (tools/blender/worldmap/ + public/assets/monde/)
Tu possèdes UNIQUEMENT `tools/blender/worldmap/` (tes scripts, ta propre lib —
tu peux IMPORTER gmlib/gmtown mais pas les modifier) et `public/assets/monde/`.
AUCUN commit git.

Style : diorama low-poly doux façon Pixar, caméra ~55°, lumière chaude douce +
brume de profondeur (mist) légère. Monde insulaire entouré de mer.

Biomes/lieux à composer (cohérents avec le jeu — ligues nationales puis
tournoi international au-delà des mers) :
- centre-sud : la VILLE du joueur (réutilise les bâtiments gmtown en mini).
- ouest : forêt dense (conifères + feuillus, clairière).
- nord : montagnes enneigées + col.
- est : donjon/ruines (tours brisées, entrée sombre).
- nord-est : royaume magique (île flottante, cristaux émissifs, tour de mage).
- sud : côte/port (jetée, navire).
- île lointaine au large (coin supérieur) : colisée du Tournoi des Champions.

LIVRABLES :
1. `public/assets/monde/carte.png` — 2048×2730 (portrait), fond plein.
2. Couches séparées : `carte_fond.png` (ciel/mer/terre), `carte_milieu.png`
   (reliefs/biomes, alpha), `carte_premier.png` (props proches, alpha).
3. `public/assets/monde/lieux.json` — positions normalisées (0..1) :
   `[{"id":"ville","nom":"Votre cité","x":0.5,"y":0.62}, {"id":"ligue_bronze",...},
   {"id":"ligue_argent",...}, {"id":"ligue_or",...}, {"id":"coupe",...},
   {"id":"tournoi_international",...}]` — place-les sur des lieux visibles de la carte.
4. Bibliothèque de props (alpha, 256-512) : `public/assets/monde/props/`
   `sapin, chene, rocher_a, rocher_b, montagne, donjon, tour_mage, cristal,
   pont, navire, colisee_mini` (.png).
5. `tools/blender/worldmap/DOC.md` : palette (hex), structure des couches,
   comment recomposer la carte.
Itère visuellement (rendu basse résolution d'abord, Read, corrige, puis 2048).

## Technique commune
- Blender : `/opt/blender/blender -b -P script.py` — Cycles CPU, denoise
  OPENIMAGEDENOISE, samples 28-48, film transparent pour les sprites/props.
- Pillow dispo (`/usr/local/bin/python3`). Budget : machine partagée (4 cœurs),
  lance tes rendus par lots séquentiels, log ta progression sur stdout.
