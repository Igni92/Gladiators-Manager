/** Ville — hub interactif vue de dessus : bâtiments pré-rendus posés sur une place. */

import { assets } from './assets';

export interface Batiment {
  id: string;
  nom: string;
  x: number;
  y: number;
  taille: number;
  ecran: string;
}

/** Coordonnées sur une carte virtuelle 1000×1500 (portrait). */
export const BATIMENTS_VILLE: Batiment[] = [
  { id: 'arene', nom: 'Arène', x: 500, y: 300, taille: 520, ecran: 'arene' },
  { id: 'marche', nom: 'Marché', x: 205, y: 640, taille: 300, ecran: 'marche' },
  { id: 'caserne', nom: 'Caserne', x: 800, y: 640, taille: 300, ecran: 'caserne' },
  { id: 'taverne', nom: 'Taverne', x: 195, y: 1010, taille: 290, ecran: 'taverne' },
  { id: 'banque', nom: 'Banque', x: 805, y: 1010, taille: 300, ecran: 'banque' },
  { id: 'infirmerie', nom: 'Infirmerie', x: 500, y: 1300, taille: 290, ecran: 'infirmerie' },
];

const DECOR: { id: string; x: number; y: number; taille: number }[] = [
  { id: 'fontaine', x: 500, y: 810, taille: 150 },
  { id: 'statue', x: 500, y: 1060, taille: 160 },
  { id: 'arbre_a', x: 90, y: 420, taille: 120 },
  { id: 'arbre_b', x: 905, y: 400, taille: 130 },
  { id: 'arbre_a', x: 930, y: 1250, taille: 120 },
  { id: 'arbre_b', x: 80, y: 1280, taille: 125 },
  { id: 'arbre_a', x: 360, y: 620, taille: 100 },
  { id: 'arbre_b', x: 645, y: 615, taille: 105 },
  { id: 'puits', x: 660, y: 855, taille: 120 },
  { id: 'charrette', x: 330, y: 870, taille: 130 },
  { id: 'caisses', x: 320, y: 530, taille: 105 },
  { id: 'caisses', x: 905, y: 1105, taille: 100 },
  { id: 'lampe', x: 415, y: 950, taille: 95 },
  { id: 'lampe', x: 590, y: 950, taille: 95 },
  { id: 'buisson', x: 200, y: 770, taille: 90 },
  { id: 'buisson', x: 795, y: 790, taille: 92 },
  { id: 'buisson', x: 95, y: 880, taille: 85 },
  { id: 'arbre_a', x: 250, y: 1170, taille: 105 },
  { id: 'arbre_b', x: 760, y: 1180, taille: 108 },
];

export class SceneVille {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private echelle = 1;
  private dx = 0;
  private dy = 0;
  private t = 0;
  private anim = 0;
  surBatiment: (b: Batiment) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d indisponible');
    this.ctx = ctx;
    canvas.addEventListener('pointerdown', (e) => this.tap(e));
  }

  demarrer(): void {
    const boucle = (ts: number) => {
      this.t = ts / 1000;
      this.redimensionner();
      this.dessiner();
      this.anim = requestAnimationFrame(boucle);
    };
    this.anim = requestAnimationFrame(boucle);
  }

  arreter(): void {
    cancelAnimationFrame(this.anim);
  }

  private redimensionner(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    // couvre l'écran (crop éventuel) en gardant tout le contenu utile visible
    this.echelle = Math.max((w * dpr) / 1000, (h * dpr) / 1500);
    this.dx = (w * dpr - 1000 * this.echelle) / 2;
    this.dy = (h * dpr - 1500 * this.echelle) / 2;
  }

  /** coordonnées écran → carte */
  private versCarte(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = (e.clientX - r.left) * dpr;
    const py = (e.clientY - r.top) * dpr;
    return { x: (px - this.dx) / this.echelle, y: (py - this.dy) / this.echelle };
  }

  private tap(e: PointerEvent): void {
    const p = this.versCarte(e);
    for (const b of BATIMENTS_VILLE) {
      const demi = b.taille / 2;
      if (Math.abs(p.x - b.x) < demi * 0.82 && p.y > b.y - demi * 0.85 && p.y < b.y + demi * 0.75) {
        this.surBatiment(b);
        return;
      }
    }
  }

  private dessiner(): void {
    const ctx = this.ctx;
    const { width: W, height: H } = this.canvas;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#5e4a28';
    ctx.fillRect(0, 0, W, H);

    ctx.translate(this.dx, this.dy);
    ctx.scale(this.echelle, this.echelle);

    // sol du village pré-rendu en 3D (chemins, herbe, place dallée)
    const sol = assets.image('bat_sol_ville');
    if (sol) {
      ctx.drawImage(sol, 0, 0, 1000, 1500);
    } else {
      // secours : aplat + chemins dessinés
      const grad = ctx.createLinearGradient(0, 0, 0, 1500);
      grad.addColorStop(0, '#9a7b48');
      grad.addColorStop(1, '#7a5e34');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1000, 1500);
      ctx.strokeStyle = '#b59a68';
      ctx.lineCap = 'round';
      ctx.lineWidth = 64;
      const place = { x: 500, y: 880 };
      for (const b of BATIMENTS_VILLE) {
        ctx.beginPath();
        ctx.moveTo(place.x, place.y);
        ctx.quadraticCurveTo((place.x + b.x) / 2, (place.y + b.y) / 2 + 30, b.x, b.y + b.taille * 0.2);
        ctx.stroke();
      }
    }

    // bâtiments + décor triés par y (peintre)
    const tout: { id: string; nom?: string; x: number; y: number; taille: number; tappable?: boolean }[] = [
      ...DECOR,
      ...BATIMENTS_VILLE.map((b) => ({ ...b, tappable: true })),
    ];
    tout.sort((a, b) => a.y - b.y);

    for (const o of tout) {
      const img = assets.image(`bat_${o.id}`);
      const pulse = o.tappable ? 1 + Math.sin(this.t * 2 + o.x) * 0.006 : 1;
      const t = o.taille * pulse;
      if (img) {
        ctx.drawImage(img, o.x - t / 2, o.y - t / 2, t, t);
      } else {
        // fallback si l'asset manque
        ctx.fillStyle = '#5d4423';
        ctx.fillRect(o.x - t / 3, o.y - t / 3, (t * 2) / 3, (t * 2) / 3);
      }
      if (o.nom) {
        ctx.font = '700 30px Georgia, serif';
        ctx.textAlign = 'center';
        const ty = o.y + t / 2 - 8;
        const larg = ctx.measureText(o.nom).width + 36;
        ctx.fillStyle = 'rgba(20,13,5,0.78)';
        ctx.beginPath();
        ctx.roundRect(o.x - larg / 2, ty - 26, larg, 40, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(212,160,23,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f0c75e';
        ctx.fillText(o.nom, o.x, ty + 3);
      }
    }

    // fumée de la cheminée de la taverne
    const taverne = BATIMENTS_VILLE.find((b) => b.id === 'taverne');
    if (taverne) {
      for (let i = 0; i < 4; i++) {
        const cyc = (this.t * 0.32 + i / 4) % 1;
        const sx = taverne.x + 52 + Math.sin(this.t * 1.7 + i * 2.4) * 12 * cyc;
        const sy = taverne.y - 88 - cyc * 120;
        ctx.fillStyle = `rgba(225,220,210,${0.30 * (1 - cyc)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 10 + cyc * 22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // un oiseau qui traverse de temps en temps
    const cycOiseau = (this.t * 0.05) % 1;
    if (cycOiseau < 0.45) {
      const ox = -60 + (cycOiseau / 0.45) * 1120;
      const oy = 240 + Math.sin(this.t * 2.2) * 16;
      ctx.strokeStyle = 'rgba(30,22,12,0.7)';
      ctx.lineWidth = 4;
      const aile = Math.sin(this.t * 9) * 8;
      ctx.beginPath();
      ctx.moveTo(ox - 12, oy - aile);
      ctx.quadraticCurveTo(ox, oy + 4, ox + 12, oy - aile);
      ctx.stroke();
    }

    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(10,6,2,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}
