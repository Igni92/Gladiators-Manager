# Design System — Gladiators Manager

Mobile-first (portrait, 430×932 de référence), tactile uniquement (tap, pas de
hover), direction « Pixar fantasy » : parchemin, or et bois sombre, formes
rondes, retours immédiats. Source de vérité : `src/ui/tokens.css`.

## 1. Tokens

### Couleurs
| Token | Valeur | Usage |
|---|---|---|
| `--col-surface-0..3` | #16100a → #3d2c17 | fonds d'app → panneaux relevés |
| `--col-border` | #5d4423 | bordures bois |
| `--col-primary` / `-bright` / `-ink` | #d4a017 / #f0c75e / #2b1c02 | actions, accents, texte sur or |
| `--col-text` / `-strong` / `-muted` | #f3e9d2 / #e8d5a9 / #b09c78 | texte (AA sur surface-0) |
| `--col-success` / `-danger` / `-info` | #27ae60 / #c0392b / #2980b9 | sémantiques |

Paliers de cartes (SS→D) : dégradés dédiés dans `src/data/balance.ts`
(`TIER_COULEURS`) — SS irisé, S braise, A or, B argent, C bronze, D acier.

### Typographie
`--font-body` (Avenir Next/system) pour l'interface, `--font-display`
(Georgia) pour le logo/titres de la ville. Échelle : 11 / 12.5 / 14 / 16 /
19 / 24 / 30 px. Corps de texte ≥ 12.5 px pour la lisibilité mobile.

### Espacements & rayons
Échelle 4 px (`--space-1..6`). Rayons : 9 / 12 / 14 / 18 px + pilule.

### Mouvement
| Token | Durée | Usage |
|---|---|---|
| `--motion-press` | 70 ms | feedback tactile (scale 0.94-0.97), < 100 ms garanti |
| `--motion-fast` | 150 ms | modales, toasts |
| `--motion-screen` | 240 ms | entrée d'écran (fondu + translation 10 px) |

GPU uniquement (`transform`/`opacity`), `prefers-reduced-motion` respecté.
Les canvas (ville, combat, monde) tournent en rAF avec `devicePixelRatio` ≤ 2.

## 2. Composants (src/ui/composants.ts + style.css)

| Composant | Classe | Notes |
|---|---|---|
| Carte gladiateur | `.carte-glad` (+`.petite`) | façon FIFA : note, palier, race, portrait, 6 traits, talents (icônes / « ? ») |
| Fiche détaillée | `.fiche-glad` | barres moral/forme/fatigue, talents, actions |
| En-tête d'écran | `.entete` | retour, titre, aide « ? », trésorerie (icône PO) |
| Boutons | `.btn` (+`.principal/.danger/.large/.mini`) | relief 3D, état :active enfoncé |
| Panneaux | `.panneau` | conteneur standard de contenu |
| Onglets | `.onglets`/`.onglet` | navigation interne d'écran |
| Chips | `.chip` | choix d'entraînement, options |
| Pastilles | `.pastille` | barre d'état de la ville |
| Modale | `.modale-fond`/`.modale` | pop 150 ms, fermeture par fond |
| Toasts | `.toasts`/`.toast` | file de messages furtifs |
| Tableau classement | `.classement` | ligne joueur surlignée or |
| Placement | `.placement-*`, `.mini-glad` | grille 3×3 type AFK Arena |
| Taux gacha | `.taux-*` | barres de probabilité par palier |
| Tutoriel | `.tuto`, `.tuto-points` | 5 étapes, points de progression |

Icônes : PNG 3D pré-rendus (`assets/icons/*.png`) via `icone(nom, taille)` —
jamais d'emoji pour la monnaie/stats/talents (emoji tolérés pour l'ambiance).

## 3. Accessibilité
- Contrastes : texte principal #f3e9d2 sur #16100a ≈ 12:1 ; texte sur or
  #2b1c02 sur #d4a017 ≈ 7:1 (AA/AAA).
- Cibles tactiles ≥ 38 px ; libellés explicites en français ; pas de hover requis.
- `prefers-reduced-motion` désactive les animations d'écran.

## 4. Écrans
titre · ville (hub canvas) · monde (carte) · arène (5 onglets) · marché ·
caserne · taverne · banque · infirmerie · équipe · match (sélection →
placement → combat → résultat). Tous portent un bouton d'aide contextuelle.
