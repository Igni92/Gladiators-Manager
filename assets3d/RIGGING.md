# Assets 3D — rigging et intégration moteur

Personnages « Pixar fantasy » de Gladiators Manager, exportés pour un moteur
temps réel (Unity/Unreal/Three.js). Générés par `tools/blender/export_fbx.py`
(reproductible) depuis le système paramétrique `gmlib.py`.

## Catalogue (42 assets × 3 LOD)

| Famille | Fichiers | Contenu |
|---|---|---|
| Têtes | `tete_{race}_{genre}_lod{0-2}.fbx` (12×3) | crâne, yeux (iris/pupille/reflet), bouche, cheveux/barbe, traits raciaux (oreilles d'elfe, défenses d'orc, cornes/museau drakéides…) |
| Corps | `corps_{race}_{corpulence}_lod{0-2}.fbx` (18×3) | torse, bras, mains, jambes, pieds — peau nue, 3 corpulences (0 mince ×0,88 · 1 moyen · 2 massif ×1,18) |
| Armures | `armure_{classe}_lod{0-2}.fbx` (6×3) | plastron, épaulières, casque/coiffe, jupe/robe, brassards, ceinture |
| Armes | `armes_{classe}_lod{0-2}.fbx` (6×3) | arme(s) de la classe + bouclier le cas échéant |

Races : humain, elfe, nain, orc, gobelin, drakeide. Classes : colosse,
bretteur, roublard, lancier, mage, berserker.

## Squelette (commun à tous les assets)

Hiérarchie de 13 bones, skinning rigide (1 vertex group par mesh, poids 1.0 —
style cartoon segmenté, déformation par articulation comme dans le jeu) :

```
pelvis
├── spine
│   ├── neck            (tête)
│   ├── shoulder_L ── elbow_L ── grip_L   (main/arme gauche)
│   └── shoulder_R ── elbow_R ── grip_R   (main/arme droite)
├── hip_L ── knee_L     (jambe gauche)
└── hip_R ── knee_R     (jambe droite)
```

Mix-and-match dans le moteur : importer un corps + une tête + une armure +
des armes ; les squelettes étant identiques (mêmes noms/hiérarchie, échelle
relative par race), re-cibler les meshes sur une seule instance d'armature
(« skinned mesh merge » standard). Les poses/animations du jeu (idle, walk,
attack, hit, death, cast) sont définies en rotations d'articulations dans
`gmlib.py::get_pose` — directement transposables en clips.

## Budgets de triangles (mesurés à l'export)

- LOD0 : ≤ 20 000 tris (personnage complet assemblé : 10-20k)
- LOD1 : ratio 0,45 (≈ 8k assemblé)
- LOD2 : ratio 0,18 (≈ 3k assemblé) — Decimate « Collapse »

## Textures (`assets3d/textures/`)

Par asset : `_albedo.png` (512², bake Cycles, UV Smart Project),
`_normal.png` (neutre — le détail est géométrique), `_roughness.png` et
`_metallic.png` (valeurs uniformes mesurées sur les matériaux source,
listées aussi dans `_pbr.txt`). sRGB pour l'albedo, linéaire pour le reste.

## Reproduire / étendre

```bash
/opt/blender/blender -b -P tools/blender/export_fbx.py              # tout
/opt/blender/blender -b -P tools/blender/export_fbx.py -- tete_orc_m
/usr/local/bin/python3 tools/blender/finaliser_pbr.py               # cartes PBR
```
