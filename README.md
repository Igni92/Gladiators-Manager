# ⚔️ Gladiators Manager

Un *Football Manager* dans un monde de gladiateurs fantasy : recrutez, entraînez
et payez une écurie de gladiateurs mercenaires, négociez les transferts et menez
votre équipe de la Ligue de Bronze jusqu'au Tournoi des Champions.

**Jouer (mobile d'abord) :** https://igni92.github.io/Gladiators-Manager/

## Comment jouer

1. **Fondez votre écurie** : vous démarrez en Ligue de Bronze avec 5 gladiateurs
   modestes et 2 500 pièces d'or. Un tutoriel illustré vous accueille, et chaque
   écran a son bouton d'aide « ? ».
2. **La ville est votre QG** : touchez les bâtiments — Arène (compétitions),
   Marché (transferts), Caserne (entraînement), Taverne (rumeurs et taux
   d'apparition des recrues), Banque (finances), Infirmerie (soins) — et la
   carte du monde 🗺️.
3. **Six races jouables** — humain, elfe, nain, orc, gobelin, drakéide — chacune
   avec ses points forts (l'orc cogne, le gobelin esquive, le drakéide a le
   sang magique…), croisées avec 6 classes de combat.
4. **Les combats 3c3 façon AFK Arena** : choisissez 3 titulaires, PLACEZ-les sur
   la grille (cogneurs devant, tireurs au centre, mages derrière), puis le
   combat se joue tout seul — consignes en direct (agressif/défensif/magie),
   ciblage au doigt, ou **Passer**. Couteaux et javelots (Fourberie) se
   BLOQUENT plus facilement (Intelligence) que les coups au corps à corps.
5. **Talents cachés** : jusqu'à 2 par gladiateur (bombe fumigène, riposte,
   increvable…), révélés quand ils se déclenchent dans VOS matchs. Un « ? »
   sur une carte du marché = un pari.
6. **Payez bien vos gladiateurs** : un combattant sous-payé pour son palier
   (SS → D) perd du moral et performe moins.
7. **Le marché n'ouvre qu'entre les compétitions** (semaines 1-2, 17-18,
   27-30) : négociation double — prix au vendeur, salaire au gladiateur. Votre
   réputation améliore les chances de voir apparaître des hauts paliers
   (affichées à la Taverne).
8. **Grimpez** : montée/descente, Coupe du Royaume, puis Tournoi des Champions
   international (réputation 60) au-delà des mers.

## Technique

- TypeScript strict + Vite, Canvas 2D, zéro dépendance d'exécution (hors
  Capacitor). Interface 100 % française, tactile d'abord.
- **Assets pré-rendus en 3D, direction Pixar fantasy** : 36 spritesheets
  (6 races × 6 classes, 4 directions animées), 72 portraits (race × genre ×
  classe), village avec sol pré-rendu et décor, carte du monde 2048×2730 en
  3 couches + 11 props, 26 icônes — le tout modélisé et rendu par des scripts
  Python Blender headless reproductibles (`tools/blender/`).
- **Livrables moteur 3D** (`assets3d/`) : 42 assets modulaires FBX riggés
  (têtes/corps/armures/armes, squelette 13 bones) × 3 LOD + textures PBR,
  documentés dans RIGGING.md pour le mix-and-match dans un moteur temps réel.
- **Design system** documenté (`src/ui/tokens.css`, DESIGN_SYSTEM.md).
- Sauvegarde automatique en localStorage (une partie = plusieurs saisons).
- Équilibrage validé par simulation headless : `npm run sim` (voir
  [EQUILIBRAGE.md](EQUILIBRAGE.md)).
- Test visuel iPhone headless avec captures : `npm run test:visual`.

```bash
npm install
npm run dev          # développement
npm run build        # build strict (tsc + vite)
npm run sim          # simulation d'équilibrage multi-saisons
npm run test:visual  # parcours complet headless + captures d'écran
```

## Applications natives (Capacitor)

Les projets `android/` et `ios/` sont scaffoldés (appId `com.gladiators.manager`).

```bash
npm run build && npx cap sync
npx cap open android   # Android Studio
npx cap open ios       # Xcode (macOS)
```

Pour publier : générer les icônes/splash (`@capacitor/assets`), signer, puis
suivre les checklists Play Store / App Store habituelles.
