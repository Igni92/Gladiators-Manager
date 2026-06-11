/** Carte du monde : biomes, lieux des compétitions, prochaine échéance. */

import { equipeJoueur, matchDuJoueur } from '../../game/competitions';
import { BALANCE } from '../../data/balance';
import { assets } from '../../render/assets';
import { enTete } from '../composants';
import { el } from '../dom';
import { jeu } from '../jeu';

interface Lieu {
  id: string;
  nom: string;
  x: number;
  y: number;
}

const LIEUX_DEFAUT: Lieu[] = [
  { id: 'ville', nom: 'Votre cité', x: 0.5, y: 0.62 },
  { id: 'ligue_bronze', nom: 'Ligue de Bronze', x: 0.32, y: 0.7 },
  { id: 'ligue_argent', nom: 'Ligue d’Argent', x: 0.68, y: 0.52 },
  { id: 'ligue_or', nom: 'Ligue d’Or', x: 0.45, y: 0.38 },
  { id: 'coupe', nom: 'Coupe du Royaume', x: 0.6, y: 0.27 },
  { id: 'tournoi_international', nom: 'Tournoi des Champions', x: 0.8, y: 0.1 },
];

let lieuxCharges: Lieu[] | null = null;

async function chargerLieux(): Promise<Lieu[]> {
  if (lieuxCharges) return lieuxCharges;
  try {
    const rep = await fetch(`${import.meta.env.BASE_URL}assets/monde/lieux.json`);
    if (rep.ok) {
      const data = (await rep.json()) as Lieu[];
      const noms = new Map(LIEUX_DEFAUT.map((l) => [l.id, l.nom]));
      lieuxCharges = data.map((l) => ({ ...l, nom: l.nom || noms.get(l.id) || l.id }));
      return lieuxCharges;
    }
  } catch {
    // carte pas encore livrée : positions par défaut
  }
  lieuxCharges = LIEUX_DEFAUT;
  return lieuxCharges;
}

export function rendreMonde(): void {
  const etat = jeu.etat;
  if (!etat) return jeu.aller('titre');
  const racine = jeu.racine();
  racine.innerHTML = '';
  const joueur = equipeJoueur(etat);

  const ecran = el('div', { class: 'ecran', 'data-testid': 'ecran-monde' });
  ecran.append(enTete('Carte du monde', () => jeu.aller('ville'), 'monde'));

  const wrap = el('div', { class: 'ville-canvas-wrap' });
  const canvas = el('canvas', { class: 'plein', 'data-testid': 'canvas-monde' }) as HTMLCanvasElement;
  wrap.append(canvas);
  ecran.append(wrap);

  // légende du bas : prochaine échéance
  const match = matchDuJoueur(etat);
  const nomsDiv = ['Ligue d’Or', 'Ligue d’Argent', 'Ligue de Bronze'];
  let echeance = `Votre écurie concourt en ${nomsDiv[joueur.division] ?? 'ligue'}.`;
  let lieuActif = ['ligue_or', 'ligue_argent', 'ligue_bronze'][joueur.division] ?? 'ville';
  if (match) {
    if (match.competition === 'coupe') {
      echeance = 'Prochaine échéance : la Coupe du Royaume !';
      lieuActif = 'coupe';
    } else if (match.competition === 'international') {
      echeance = 'Prochaine échéance : le Tournoi des Champions, au-delà des mers !';
      lieuActif = 'tournoi_international';
    } else {
      echeance = `Match de ${nomsDiv[joueur.division] ?? 'ligue'} cette semaine.`;
    }
  } else if (joueur.reputation < BALANCE.REPUTATION_INTL) {
    echeance += ` L’île du Tournoi des Champions attend les écuries de réputation ${BALANCE.REPUTATION_INTL}+ (vous : ${Math.round(joueur.reputation)}).`;
  }
  ecran.append(
    el('div', { class: 'ville-bas' }, el('div', { class: 'info-semaine' }, echeance)),
  );
  racine.append(ecran);

  let lieux = LIEUX_DEFAUT;
  let anim = 0;
  const dessiner = (ts: number): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = ts / 1000;

    // carte (cover) ou repli stylisé
    const img = assets.image('monde_carte');
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, w, h);
    let ech = 1;
    let ox = 0;
    let oy = 0;
    if (img) {
      ech = Math.max(w / img.width, h / img.height);
      ox = (w - img.width * ech) / 2;
      oy = (h - img.height * ech) / 2;
      ctx.drawImage(img, ox, oy, img.width * ech, img.height * ech);
    } else {
      // repli : mer dégradée + île esquissée en attendant la cartographie
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#16324f');
      grad.addColorStop(1, '#0d1b2a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3a5a40';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.55, w * 0.38, h * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = `600 ${Math.round(14 * dpr)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Les cartographes achèvent leur ouvrage…', w / 2, h * 0.94);
    }

    // marqueurs
    const versEcran = (l: Lieu): [number, number] =>
      img ? [ox + l.x * img.width * ech, oy + l.y * img.height * ech] : [l.x * w, l.y * h];
    for (const l of lieux) {
      const [x, y] = versEcran(l);
      const actif = l.id === lieuActif;
      const pulse = actif ? 1 + Math.sin(t * 4) * 0.15 : 1;
      ctx.fillStyle = actif ? '#f0c75e' : 'rgba(240,199,94,0.75)';
      ctx.strokeStyle = 'rgba(20,13,5,0.85)';
      ctx.lineWidth = 2.5 * dpr;
      // goutte de localisation
      const r = (actif ? 11 : 8) * dpr * pulse;
      ctx.beginPath();
      ctx.arc(x, y - r * 1.4, r, Math.PI * 0.95, Math.PI * 2.05);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2b1c02';
      ctx.beginPath();
      ctx.arc(x, y - r * 1.4, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      // libellé
      ctx.font = `700 ${Math.round((actif ? 13 : 11.5) * dpr)}px sans-serif`;
      ctx.textAlign = 'center';
      const larg = ctx.measureText(l.nom).width + 14 * dpr;
      ctx.fillStyle = 'rgba(20,13,5,0.8)';
      ctx.beginPath();
      ctx.roundRect(x - larg / 2, y + 4 * dpr, larg, 19 * dpr, 9 * dpr);
      ctx.fill();
      ctx.fillStyle = actif ? '#f0c75e' : '#e8d5a9';
      ctx.fillText(l.nom, x, y + 17.5 * dpr);
    }

    anim = requestAnimationFrame(dessiner);
  };

  void chargerLieux().then((l) => {
    lieux = l;
  });
  void assets.chargerImageOptionnelle('monde_carte', `${import.meta.env.BASE_URL}assets/monde/carte.png`).then(() => {
    // la boucle rAF prendra la carte au prochain tour
  });
  anim = requestAnimationFrame(dessiner);

  // stoppe la boucle quand on quitte l'écran (l'élément est retiré du DOM)
  const observer = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      cancelAnimationFrame(anim);
      observer.disconnect();
    }
  });
  observer.observe(racine, { childList: true });
}
