# ⚔️ Gladiators Manager

Un *Football Manager* dans un monde de gladiateurs fantasy : recrutez, entraînez
et payez une écurie de gladiateurs mercenaires, négociez les transferts et menez
votre équipe de la Ligue de Bronze jusqu'au Tournoi des Champions.

**Jouer (mobile d'abord) :** https://igni92.github.io/Gladiators-Manager/

## Comment jouer

1. **Fondez votre écurie** : vous démarrez en Ligue de Bronze avec 5 gladiateurs
   modestes et 2 500 pièces d'or.
2. **La ville est votre QG** : touchez les bâtiments — Arène (compétitions),
   Marché (transferts), Caserne (entraînement), Taverne (rumeurs), Banque
   (finances), Infirmerie (soins).
3. **Les matchs sont des combats 3c3** vus de dessus : choisissez 3 titulaires
   (+ 2 remplaçants), donnez des consignes en direct (agressif / défensif /
   magie / cibler un adversaire au doigt) ou appuyez sur **Passer** pour aller
   au résultat.
4. **Payez bien vos gladiateurs** : un combattant sous-payé par rapport à son
   palier (SS, S, A, B, C, D) perd du moral et performe moins ; bien payé, il
   surperforme.
5. **Le marché n'ouvre qu'entre les compétitions** (semaines 1-2, 17-18,
   27-30) : c'est là que les écuries rivales font des offres sur vos hommes et
   que vous pouvez négocier — prix au vendeur, salaire au gladiateur.
6. **Grimpez** : montée/descente en fin de saison, Coupe du Royaume dès que
   vous êtes qualifié, et Tournoi des Champions international à 60 de
   réputation.

## Technique

- TypeScript strict + Vite, Canvas 2D, zéro dépendance d'exécution (hors
  Capacitor). Interface 100 % française, tactile d'abord.
- **Assets pré-rendus en 3D** : tout (sprites 4 directions × 6 classes,
  portraits, bâtiments, arène, écran titre, icône) est modélisé et rendu par
  des scripts Python Blender headless reproductibles (`tools/blender/`).
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
