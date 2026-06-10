/** Banque : trésorerie, masse salariale, graphe, journal des finances. */

import { equipeJoueur } from '../../game/competitions';
import { masseSalariale, satisfaction } from '../../game/economie';
import { BALANCE } from '../../data/balance';
import { enTete } from '../composants';
import { el, fmtPO, fmtSigne } from '../dom';
import { jeu } from '../jeu';

export function rendreBanque(): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-banque' });
  ecran.append(enTete('Banque'));
  const contenu = el('div', { class: 'contenu' });

  const masse = masseSalariale(etat, joueur);
  const revenuPassif = Math.round(BALANCE.REVENU_PASSIF_BASE + BALANCE.REVENU_PASSIF_REPUT * joueur.reputation);
  const net = revenuPassif - masse;

  contenu.append(
    el('div', { class: 'panneau centre' },
      el('div', { class: 'texte-faible' }, 'Trésorerie'),
      el('div', { style: `font-size:34px;font-weight:900;color:${joueur.tresorerie >= 0 ? 'var(--or-clair)' : 'var(--rouge)'};`, 'data-testid': 'banque-tresorerie' }, fmtPO(joueur.tresorerie)),
      joueur.semainesDettes > 0
        ? el('div', { class: 'badge-alerte', style: 'display:inline-block;margin-top:6px;' }, `⚠️ Dette depuis ${joueur.semainesDettes} sem. (départs forcés à ${BALANCE.SEMAINES_DETTE_MAX})`)
        : null,
    ),
  );

  // courbe de trésorerie
  const spark = el('canvas', { class: 'spark' }) as HTMLCanvasElement;
  contenu.append(el('div', { class: 'panneau' }, el('h2', null, 'Évolution'), spark));
  requestAnimationFrame(() => dessinerSpark(spark, etat.historiqueTresorerie));

  // budget hebdo
  const panneauBudget = el('div', { class: 'panneau' }, el('h2', null, 'Budget hebdomadaire'));
  panneauBudget.append(
    ligneMontant('Recettes de l’écurie (réputation)', revenuPassif),
    ligneMontant('Masse salariale', -masse),
    el('div', { class: 'ligne-liste', style: 'font-weight:900;' },
      el('div', { style: 'flex:1;' }, 'Net hors primes de match'),
      el('div', { style: `color:${net >= 0 ? 'var(--vert)' : 'var(--rouge)'};` }, `${fmtSigne(net)} PO/sem`)),
  );
  contenu.append(panneauBudget);

  // salaires détaillés
  const panneauSalaires = el('div', { class: 'panneau' }, el('h2', null, 'Salaires'));
  for (const id of joueur.gladiateurIds) {
    const g = etat.gladiateurs[id];
    if (!g) continue;
    const s = satisfaction(g);
    const humeur = s >= 1.02 ? '😄' : s >= 0.92 ? '🙂' : s >= 0.8 ? '😒' : '😠';
    panneauSalaires.append(
      el('div', { class: 'ligne-liste' },
        el('div', { style: 'flex:1;' }, `${humeur} ${g.nom}`),
        el('div', { style: 'font-weight:700;' }, `${fmtPO(g.salaire)}/sem`)),
    );
  }
  contenu.append(panneauSalaires);

  // journal
  const journal = el('div', { class: 'panneau' }, el('h2', null, 'Journal'));
  for (const l of [...etat.finances].slice(-25).reverse()) {
    journal.append(ligneMontant(`S${l.saison}·s${l.semaine} — ${l.libelle}`, l.montant));
  }
  contenu.append(journal);

  ecran.append(contenu);
  racine.append(ecran);
}

function ligneMontant(libelle: string, montant: number): HTMLElement {
  return el('div', { class: 'ligne-liste', style: 'font-size:13px;' },
    el('div', { style: 'flex:1;' }, libelle),
    el('div', { style: `font-weight:800;color:${montant >= 0 ? 'var(--vert)' : 'var(--rouge)'};white-space:nowrap;` }, `${fmtSigne(montant)} PO`));
}

function dessinerSpark(canvas: HTMLCanvasElement, donnees: number[]): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth * dpr;
  const h = canvas.clientHeight * dpr;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || donnees.length < 2) return;
  const min = Math.min(0, ...donnees);
  const max = Math.max(100, ...donnees);
  const x = (i: number) => (i / (donnees.length - 1)) * (w - 8) + 4;
  const y = (v: number) => h - 6 - ((v - min) / (max - min || 1)) * (h - 12);
  // ligne du zéro
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y(0));
  ctx.lineTo(w, y(0));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#f0c75e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  donnees.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
  ctx.stroke();
}
