# Équilibrage — Gladiators Manager

Toutes les constantes vivent dans `src/data/balance.ts` et sont validées par la
simulation headless `npm run sim` (tools/sim/simulate.ts), qui joue 5 saisons
complètes × 4 graines en « jeu normal » et 3 saisons × 3 graines en « inactif ».

## Invariants vérifiés par la simulation

| Invariant | Résultat mesuré |
|---|---|
| Duel d'équipes égales (ovr 55) | ~47 % de victoires équipe A |
| +10 de note globale | ~93 % de victoires |
| +20 de note globale | ~100 % de victoires |
| Jeu normal, 5 saisons | 50-58 % de victoires, 0 faillite, trésorerie finale > 1000 PO |
| Progression | montée en Ligue d'Argent ou d'Or en ≤ 5 saisons |
| Inactif (forfaits), 3 saisons | jamais plus riche qu'au départ, érosion lente |

## Le moteur de combat (3c3, temps réel simulé à 30 ticks/s)

Chaque trait a un rôle précis :

- **Force** : dégâts mêlée (`7 + FOR×0,32` × arme de classe) et PV (`110 + FOR×2,1 + ovr×0,9` × carrure).
- **Vitesse** : déplacement (`52 + VIT×1,05` u/s) et cadence (délai `2,0 − VIT×0,009` s, plancher 0,8 s).
- **Intelligence** : temps de réaction (choix de cible), priorisation des cibles
  blessées, et « garde » (réduction de dégâts subis, `INT×0,22 %`, cap 35 %).
- **Fourberie** : critique `FOU×0,35 %` (×1,6 dans le dos), dégâts crit ×1,8.
- **Esquive** : esquive mêlée `ESQ×0,45 %`, cap 38 % (inopérante contre la magie).
- **Magie** : ≥ 60 → lanceur de sorts. Boule de feu (`18 + MAG×0,5`, cd 4,5 s),
  nova de zone (`14 + MAG×0,34`, rayon 95, cd 10 s), soin (`16 + MAG×0,42`, cd 9 s).

Multiplicateur d'état appliqué aux dégâts/vitesse/PV :
`(0,92 + 0,10×satisfaction) × (0,90 + 0,20×moral/100) × (0,92 + 0,10×forme/100)`,
plus une **« forme du jour »** aléatoire ±8 % par combat — c'est elle qui donne
sa pente raisonnable à la courbe « différence de niveau → probabilité de victoire »
(sans elle, +5 ovr gagnait déjà ~90 % des matchs : injouable pour un promu).

Consignes en direct : agressif (dégâts ×1,15, défenses ×0,85), défensif (inverse),
magie (recharges des sorts ×0,65), ciblage prioritaire d'un adversaire au doigt.

## Économie (PO = pièces d'or)

- **Salaires** : `attendu(ovr) = 6 × exp((ovr−40)/13)` → ovr 50 ≈ 13, 60 ≈ 28,
  70 ≈ 60, 80 ≈ 129, 90 ≈ 278, 99 ≈ 555 PO/sem. L'exigence est modulée par la
  personnalité (fidèle ×0,85 … cupide ×1,25). Un gladiateur payé sous son
  exigence perd du moral chaque semaine et performe moins (jusqu'à −10 %
  cumulés) ; bien payé, il surperforme légèrement (+5 à +7 %).
- **Revenus** : recettes passives `60 + 1,2×réputation` /sem ; primes de ligue
  (D3 : 160/80/40, D2 : 300/150/70, D1 : 650/320/140) ; prix de fin de saison
  (D3 : 1500→320, D2 : 2600→320, D1 : 6000→700) ; Coupe (250/500/1000/2200 +
  bonus 1500) ; International (2500/5000/11000 + bonus 9000).
- **Point mort D3** : masse salariale de départ ≈ 83 PO/sem pour ~100-130 PO/sem
  de revenus à 50 % de victoires → on peut financer 2-3 entraînements
  hebdomadaires (~25 PO pièce) sans s'endetter, mais pas plus. C'est le cœur
  de la calibration : *l'inactif s'érode, le gestionnaire prudent progresse*.
- **Dette** : 4 semaines consécutives dans le rouge → vente forcée du meilleur
  gladiateur à 80 % de sa valeur ; effectif < 3 et dette profonde → faillite.

## Progression

- **Entraînement** : +`1,1 × fÂge` point de trait/semaine (fÂge : 1,4 jusqu'à
  21 ans, 1,1 jusqu'à 25, 0,75 jusqu'à 29, 0,35 ensuite), borné par le
  **potentiel** (marge tirée à la génération : 8-16 pts à ≤21 ans, 5-11 à 22-25,
  2-6 à 26-29). Fatigue +14/session, récupération passive 12/sem, repos +30.
- **Vieillissement** : à chaque intersaison, −1,6 (±40 %) en Force/Vitesse/Esquive
  après 30 ans ; retraite à 36 ans.
- **Valeur de transfert** : `attendu(ovr) × 26 × fÂge(pic 23-27) × fPotentiel`.
  Les IA offrent entre 0,75× et 1,3× la valeur ; leurs budgets cachés autorisent
  ~2 relances avant retrait.
- **Blessures** : 30 % après K.O. (2-5 sem.), 5 % par participation (1-2 sem.),
  symétriques joueur/IA ; guérisseur : 90 PO par semaine de convalescence évitée.

## Structure de la saison (30 semaines)

S1-S2 marché · S3-S16 ligue (14 journées) · S17-S18 marché · S19-S22 Coupe du
Royaume (D1 + top 4 de D2/D3 à la S18) · S23 libre · S24-S26 Tournoi des
Champions (réputation ≥ 60) · S27-S30 intersaison + marché. Montées/descentes :
2 par division. Le marché n'est ouvert qu'ENTRE les compétitions.
