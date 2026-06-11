/** Écran match : sélection d'équipe → combat 3v3 en direct (consignes) → résultat. */

import { creerCombat, placementAuto, posDepuisSlot, type Consigne, type ResultatCombat } from '../../game/combat';
import { equipeJoueur, matchDuJoueur, nomEquipe } from '../../game/competitions';
import { multiplicateurCondition, forceEquipe } from '../../game/economie';
import { noteGlobale } from '../../game/generation';
import { composerEquipeIA } from '../../game/ia';
import { adversaireAmical, enregistrerMatchJoueur, rngDe, sauverRng } from '../../game/moteur';
import type { CompetitionId, Gladiator, Team } from '../../core/types';
import { CombatRender } from '../../render/combatRender';
import { carteGladiateur, enTete, ICONES_CLASSES } from '../composants';
import { el, fmtPO, toast } from '../dom';
import { assets } from '../../render/assets';
import { jeu, type ParamsEcran } from '../jeu';

let rendu: CombatRender | null = null;

export function rendreMatch(params: ParamsEcran): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  rendu?.arreter();
  rendu = null;

  const match = matchDuJoueur(etat);
  // un seul combat par semaine, et pas d'amical quand un match officiel attend
  if (etat.matchJoue || (params.amical && match)) {
    return jeu.aller('ville');
  }
  let adversaire: Team;
  let competition: CompetitionId;
  if (params.amical || !match) {
    const rng = rngDe(etat);
    adversaire = adversaireAmical(etat, rng);
    sauverRng(etat, rng);
    competition = 'amical';
  } else {
    const adv = etat.equipes[match.adversaireId];
    if (!adv) return jeu.aller('ville');
    adversaire = adv;
    competition = match.competition;
  }

  rendreSelection(adversaire, competition);
}

const NOMS_COMPET: Record<CompetitionId, string> = {
  ligue: 'Championnat',
  coupe: 'Coupe du Royaume',
  international: 'Tournoi des Champions',
  amical: 'Match amical',
};

/* ---------------------------------------------------- sélection d'équipe ---- */

function rendreSelection(adversaire: Team, competition: CompetitionId): void {
  const etat = jeu.etat!;
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);

  const selection: number[] = [];
  const dispos = joueur.gladiateurIds
    .map((id) => etat.gladiateurs[id])
    .filter((g): g is Gladiator => !!g && !g.blessure)
    .sort((a, b) => noteGlobale(b.traits, b.classe) - noteGlobale(a.traits, a.classe));

  // pré-sélection : les 3 meilleurs en l'état
  for (const g of [...dispos].sort(
    (a, b) => noteGlobale(b.traits, b.classe) * multiplicateurCondition(b) - noteGlobale(a.traits, a.classe) * multiplicateurCondition(a),
  ).slice(0, 3)) {
    selection.push(g.id);
  }

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-selection' });
  ecran.append(enTete(`${NOMS_COMPET[competition]}`, () => jeu.aller('ville'), 'match'));

  const contenu = el('div', { class: 'contenu' });
  contenu.append(
    el(
      'div',
      { class: 'panneau centre' },
      el('h2', null, `⚔️ ${joueur.nom} contre ${adversaire.nom}`),
      el('div', { class: 'texte-faible' }, `Force estimée de l'adversaire : ${forceEquipe(etat, adversaire)}`),
    ),
  );

  const consigneTitre = el('div', { class: 'texte-faible centre', style: 'margin-bottom:8px;' });
  const grille = el('div', { class: 'grille-cartes' });
  const majTitre = () => {
    consigneTitre.textContent =
      selection.length === 0
        ? 'Choisissez 3 titulaires (tapez les cartes)'
        : `Titulaires : ${Math.min(3, selection.length)}/3` + (selection.length > 3 ? ` · Remplaçants : ${selection.length - 3}/2` : ' · puis jusqu’à 2 remplaçants');
    btnGo.disabled = selection.length < Math.min(3, dispos.length);
  };

  const rafraichirGrille = () => {
    grille.innerHTML = '';
    for (const g of dispos) {
      const idx = selection.indexOf(g.id);
      const bandeau = idx < 0 ? undefined : idx < 3 ? `TITULAIRE ${idx + 1}` : `REMPLAÇANT ${idx - 2}`;
      const carte = carteGladiateur(g, {
        petite: true,
        bandeau: bandeau ?? (g.fatigue > 65 ? 'FATIGUÉ' : undefined),
        onTap: () => {
          const i = selection.indexOf(g.id);
          if (i >= 0) selection.splice(i, 1);
          else if (selection.length < 5) selection.push(g.id);
          else toast('5 gladiateurs maximum (3 + 2 remplaçants).');
          rafraichirGrille();
          majTitre();
        },
      });
      if (idx >= 0 && idx < 3) carte.style.outline = '3px solid var(--or-clair)';
      else if (idx >= 3) carte.style.outline = '3px dashed var(--or-clair)';
      grille.append(carte);
    }
  };

  const btnGo = el(
    'button',
    {
      class: 'btn principal large',
      'data-testid': 'btn-combattre',
      onclick: () => {
        const titulaires = selection.slice(0, 3);
        if (titulaires.length === 0) return;
        rendrePlacement(adversaire, competition, titulaires, selection.slice(3, 5));
      },
    },
    '🏟️ Placer mes gladiateurs',
  );

  if (dispos.length === 0) {
    contenu.append(el('div', { class: 'panneau centre' }, 'Aucun gladiateur valide ! Tous blessés… Passez la semaine ou soignez-les.'));
  }
  contenu.append(consigneTitre, grille, el('div', { class: 'sep' }), btnGo);
  ecran.append(contenu);
  racine.append(ecran);
  rafraichirGrille();
  majTitre();
}

/* ------------------------------------------------- placement (AFK style) ---- */

function rendrePlacement(adversaire: Team, competition: CompetitionId, titulaires: number[], remplacants: number[]): void {
  const etat = jeu.etat!;
  const racine = jeu.racine();
  racine.innerHTML = '';

  const mesGlads = titulaires.map((id) => etat.gladiateurs[id]).filter((g): g is Gladiator => !!g);
  const advGlads = composerEquipeIA(etat, adversaire);
  const slotsAdv = placementAuto(advGlads);

  // placement initial : mémoire de la partie, sinon auto par classe
  const auto = placementAuto(mesGlads);
  const slots: number[] = mesGlads.map((g, i) => {
    const memo = etat.placements[g.id];
    return memo !== undefined && memo >= 0 && memo < 9 ? memo : (auto[i] ?? 4);
  });
  // doublons éventuels de la mémoire → on répare
  for (let i = 0; i < slots.length; i++) {
    while (slots.indexOf(slots[i] as number) !== i) slots[i] = ((slots[i] as number) + 1) % 9;
  }

  let selectionne = 0; // index du gladiateur en cours de placement

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-placement' });
  ecran.append(enTete('Placement', () => rendreSelection(adversaire, competition), 'match'));
  const contenu = el('div', { class: 'contenu' });
  contenu.append(
    el('div', { class: 'panneau centre', style: 'padding:8px;' },
      el('div', { style: 'font-weight:800;' }, 'Placez vos gladiateurs sur la grille'),
      el('div', { class: 'texte-faible', style: 'font-size:12px;' }, 'Cogneurs devant · tireurs au centre · mages derrière. Touchez un emplacement.')),
  );

  const wrap = el('div', { class: 'placement-wrap' });
  const canvas = el('canvas', { class: 'placement-canvas', 'data-testid': 'canvas-placement' }) as HTMLCanvasElement;
  wrap.append(canvas);

  const banc = el('div', { class: 'placement-banc' });
  const majBanc = () => {
    banc.innerHTML = '';
    mesGlads.forEach((g, i) => {
      const chip = el('div', {
        class: `mini-glad ${i === selectionne ? 'selectionne' : ''}`,
        'data-testid': `place-glad-${i}`,
        onclick: () => {
          selectionne = i;
          majBanc();
          dessiner();
        },
      },
        el('img', { src: assets.portraitUrl(g.classe, g.variante) }),
        el('div', null, `${ICONES_CLASSES[g.classe] ?? ''} ${g.nom.split(' ')[0] ?? ''}`),
      );
      banc.append(chip);
    });
  };

  const dessiner = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 400;
    canvas.width = w * dpr;
    canvas.height = w * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ech = (w * dpr) / 1000;
    ctx.save();
    ctx.scale(ech, ech);
    const bg = assets.image('arena_bg');
    if (bg) ctx.drawImage(bg, 0, 0, 1000, 1000);
    else {
      ctx.fillStyle = '#3a2b18';
      ctx.fillRect(0, 0, 1000, 1000);
    }
    // moitié adverse : aperçu fantôme
    advGlads.forEach((g, i) => {
      const p = posDepuisSlot(1, slotsAdv[i] ?? 4);
      ctx.globalAlpha = 0.75;
      const ok = assets.dessinerSprite(ctx, g.classe, 'idle', 'W', 0, p.x, p.y, 120);
      if (!ok) {
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(p.x, p.y - 14, 20, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    // grille de mes 9 emplacements
    for (let slot = 0; slot < 9; slot++) {
      const p = posDepuisSlot(0, slot);
      const occupant = slots.indexOf(slot);
      ctx.strokeStyle = occupant >= 0 ? 'rgba(240,199,94,0.9)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = occupant >= 0 ? 5 : 3;
      ctx.setLineDash(occupant >= 0 ? [] : [8, 7]);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4, 38, 20, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // mes gladiateurs placés
    mesGlads.forEach((g, i) => {
      const p = posDepuisSlot(0, slots[i] ?? 4);
      const ok = assets.dessinerSprite(ctx, g.classe, 'idle', 'E', 0, p.x, p.y, 124);
      if (!ok) {
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(p.x, p.y - 14, 20, 0, Math.PI * 2);
        ctx.fill();
      }
      if (i === selectionne) {
        ctx.strokeStyle = 'rgba(120,255,170,0.95)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 4, 44, 24, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    // légende des colonnes
    ctx.font = '700 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('AVANT', posDepuisSlot(0, 0).x, 92);
    ctx.fillText('CENTRE', posDepuisSlot(0, 1).x, 92);
    ctx.fillText('ARRIÈRE', posDepuisSlot(0, 2).x, 92);
    ctx.restore();
  };

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ech = canvas.width / 1000;
    const mx = ((e.clientX - r.left) * dpr) / ech;
    const my = ((e.clientY - r.top) * dpr) / ech;
    // d'abord : toucher un de mes gladiateurs le sélectionne
    for (let i = 0; i < mesGlads.length; i++) {
      const p = posDepuisSlot(0, slots[i] ?? 4);
      if (Math.hypot(mx - p.x, my - (p.y - 20)) < 55) {
        selectionne = i;
        majBanc();
        dessiner();
        return;
      }
    }
    // sinon : un emplacement → on y place le gladiateur sélectionné (échange si occupé)
    for (let slot = 0; slot < 9; slot++) {
      const p = posDepuisSlot(0, slot);
      if (Math.hypot(mx - p.x, my - p.y) < 60) {
        const occupant = slots.indexOf(slot);
        if (occupant >= 0 && occupant !== selectionne) slots[occupant] = slots[selectionne] ?? 4;
        slots[selectionne] = slot;
        dessiner();
        return;
      }
    }
  });

  contenu.append(wrap, banc, el('div', { class: 'sep' }),
    el('button', {
      class: 'btn principal large', 'data-testid': 'btn-lancer-combat',
      onclick: () => {
        mesGlads.forEach((g, i) => {
          etat.placements[g.id] = slots[i] ?? 4;
        });
        jeu.sauver();
        lancerCombat(adversaire, competition, titulaires, remplacants, slots);
      },
    }, '⚔️ Lancer le combat !'),
  );
  ecran.append(contenu);
  racine.append(ecran);
  majBanc();
  requestAnimationFrame(dessiner);
}

/* --------------------------------------------------------------- combat ---- */

function lancerCombat(adversaire: Team, competition: CompetitionId, titulaires: number[], remplacants: number[], placement?: number[]): void {
  const etat = jeu.etat!;
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);

  const mesGlads = titulaires.map((id) => etat.gladiateurs[id]).filter((g): g is Gladiator => !!g);
  const advGlads = composerEquipeIA(etat, adversaire);
  const rng = rngDe(etat);
  const cs = creerCombat(mesGlads, advGlads, rng.int(1, 2 ** 31), placement);
  sauverRng(etat, rng);

  const ecran = el('div', { class: 'combat-ecran', 'data-testid': 'ecran-combat' });
  const score = el('div', { class: 'combat-score', 'data-testid': 'score' }, '0 - 0');
  ecran.append(
    el(
      'div',
      { class: 'combat-haut' },
      el('div', { class: 'combat-equipe', style: 'color:#7bd88a' }, joueur.nom),
      score,
      el('div', { class: 'combat-equipe', style: `color:#ff6b5e;text-align:right` }, adversaire.nom),
    ),
  );

  const wrap = el('div', { class: 'combat-canvas-wrap' });
  const canvas = el('canvas', { class: 'plein', 'data-testid': 'canvas-combat' });
  wrap.append(canvas);
  ecran.append(wrap);

  // consignes en direct
  const consignes: { id: Consigne; nom: string }[] = [
    { id: 'equilibre', nom: '⚖️ Équilibré' },
    { id: 'agressif', nom: '🔥 Agressif' },
    { id: 'defensif', nom: '🛡️ Défensif' },
    { id: 'magie', nom: '✨ Magie' },
  ];
  const barre = el('div', { class: 'consignes' });
  const btns = new Map<Consigne, HTMLButtonElement>();
  for (const c of consignes) {
    const b = el(
      'button',
      {
        class: `btn-consigne ${c.id === 'equilibre' ? 'actif' : ''}`,
        'data-testid': `consigne-${c.id}`,
        onclick: () => {
          cs.consignes[0] = c.id;
          btns.forEach((bb, id) => bb.classList.toggle('actif', id === c.id));
        },
      },
      c.nom,
    ) as HTMLButtonElement;
    btns.set(c.id, b);
    barre.append(b);
  }
  const btnVitesse = el(
    'button',
    {
      class: 'btn-consigne',
      onclick: () => {
        if (!rendu) return;
        rendu.vitesse = rendu.vitesse === 1 ? 2 : 1;
        btnVitesse.textContent = rendu.vitesse === 1 ? '▶ ×1' : '⏩ ×2';
      },
    },
    '▶ ×1',
  );
  const btnPasser = el(
    'button',
    { class: 'btn-consigne', 'data-testid': 'btn-passer', style: 'border-color:var(--or);color:var(--or-clair)', onclick: () => rendu?.passer() },
    '⏭️ Passer',
  );
  barre.append(btnVitesse, btnPasser);
  barre.append(el('div', { class: 'indication-cible' }, 'Tapez un adversaire pour le cibler en priorité'));
  ecran.append(barre);
  racine.append(ecran);

  rendu = new CombatRender(canvas, cs);
  rendu.surTapUnite = (idx) => {
    cs.focus[0] = cs.focus[0] === idx ? -1 : idx;
    if (idx >= 0 && cs.focus[0] === idx) {
      const u = cs.unites[idx];
      if (u) toast(`🎯 Cible prioritaire : ${u.nom}`, 1400);
    }
  };
  const majScore = setInterval(() => {
    const morts1 = cs.unites.filter((u) => u.equipe === 1 && !u.vivant).length;
    const morts0 = cs.unites.filter((u) => u.equipe === 0 && !u.vivant).length;
    score.textContent = `${morts1} - ${morts0}`;
  }, 250);
  rendu.surFin = (res) => {
    clearInterval(majScore);
    rendu?.arreter();
    rendu = null;
    const messages = enregistrerMatchJoueur(etat, res, competition, adversaire.id, titulaires);
    jeu.sauver();
    rendreResultat(res, adversaire, competition, messages, [...titulaires, ...remplacants]);
  };
  rendu.demarrer();
}

/* -------------------------------------------------------------- résultat ---- */

function rendreResultat(res: ResultatCombat, adversaire: Team, competition: CompetitionId, messages: string[], _alignes: number[]): void {
  const etat = jeu.etat!;
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);
  const victoire = res.vainqueur === 0;
  const nul = res.vainqueur === -1;

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-resultat' });
  const contenu = el('div', { class: 'contenu' });

  const titre = victoire ? '🏆 VICTOIRE !' : nul ? '🤝 MATCH NUL' : '💀 DÉFAITE';
  const couleur = victoire ? 'var(--or-clair)' : nul ? 'var(--parchemin)' : 'var(--rouge)';
  contenu.append(
    el(
      'div',
      { class: 'panneau centre' },
      el('div', { style: `font-size:30px;font-weight:900;color:${couleur};margin:6px 0;`, 'data-testid': 'resultat-titre' }, titre),
      el('div', { style: 'font-size:40px;font-weight:900;margin:4px 0;' }, `${res.score[0]} - ${res.score[1]}`),
      el('div', { class: 'texte-faible' }, `${joueur.nom} vs ${adversaire.nom} · ${NOMS_COMPET[competition]} · ${Math.round(res.duree)}s`),
    ),
  );

  const detail = el('div', { class: 'panneau' }, el('h2', null, 'Performances'));
  for (const u of res.unites) {
    if (u.equipe !== 0) continue;
    const g = etat.gladiateurs[u.gid];
    detail.append(
      el(
        'div',
        { class: 'ligne-liste' },
        el('div', { style: 'flex:1;font-weight:700;' }, u.nom, u.vivant ? '' : ' 💀'),
        el('div', { class: 'texte-faible' }, `${u.elims} élim. · ${Math.round(u.degatsInfliges)} dégâts${u.soinsRendus ? ` · ${u.soinsRendus} soins` : ''}`),
        g?.blessure ? el('span', { class: 'badge-statut blesse' }, '🩹') : null,
      ),
    );
  }
  contenu.append(detail);

  if (messages.length > 0) {
    const mPanneau = el('div', { class: 'panneau' }, el('h2', null, 'Événements'));
    for (const m of messages) mPanneau.append(el('div', { class: 'ligne-liste', style: 'font-size:13.5px;' }, m));
    contenu.append(mPanneau);
  }

  const derniere = etat.finances[etat.finances.length - 1];
  if (derniere && derniere.montant > 0) {
    contenu.append(el('div', { class: 'panneau centre', style: 'color:var(--or-clair);font-weight:800;' }, `💰 ${derniere.libelle} : +${fmtPO(derniere.montant)}`));
  }

  contenu.append(
    el('button', { class: 'btn principal large', 'data-testid': 'btn-continuer', onclick: () => jeu.aller('ville') }, 'Continuer'),
  );
  ecran.append(enTete('Résultat', () => jeu.aller('ville')), contenu);
  racine.append(ecran);
  void nomEquipe;
}
