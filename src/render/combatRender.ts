/** Rendu temps réel du combat 3v3 : sprites animés, projectiles, effets, dégâts flottants. */

import { ARENE, resultatCombat, simulerJusquAuBout, tickCombat, type CombatState, type ResultatCombat, type UniteCombat } from '../game/combat';
import { BALANCE } from '../data/balance';
import { TALENTS } from '../data/talents';
import { assets } from './assets';

interface TexteFlottant {
  x: number;
  y: number;
  texte: string;
  couleur: string;
  t: number;
  grand?: boolean;
}

interface EffetRond {
  x: number;
  y: number;
  rayonMax: number;
  couleur: string;
  t: number;
  duree: number;
}

interface Etincelles {
  x: number;
  y: number;
  t: number;
  couleur: string;
}

export class CombatRender {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cs: CombatState;
  private anim = 0;
  private accu = 0;
  private dernierTs = 0;
  vitesse = 1;
  private textes: TexteFlottant[] = [];
  private ronds: EffetRond[] = [];
  private etincelles: Etincelles[] = [];
  private secousse = 0;
  private finT = -1;
  surFin: (res: ResultatCombat) => void = () => {};
  surTapUnite: (idx: number) => void = () => {};
  termine = false;

  constructor(canvas: HTMLCanvasElement, cs: CombatState) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d indisponible');
    this.ctx = ctx;
    this.cs = cs;
    canvas.addEventListener('pointerdown', (e) => this.tap(e));
  }

  demarrer(): void {
    const boucle = (ts: number) => {
      if (this.dernierTs === 0) this.dernierTs = ts;
      let dt = Math.min(0.1, (ts - this.dernierTs) / 1000);
      this.dernierTs = ts;
      this.accu += dt * this.vitesse;
      while (this.accu >= BALANCE.TICK) {
        this.accu -= BALANCE.TICK;
        if (!this.cs.termine) {
          tickCombat(this.cs);
          this.traiterEvts();
        }
      }
      if (this.cs.termine && this.finT < 0) this.finT = ts;
      this.dessiner(ts / 1000);
      if (this.cs.termine && ts - this.finT > 1400 && !this.termine) {
        this.termine = true;
        this.surFin(resultatCombat(this.cs));
        return;
      }
      this.anim = requestAnimationFrame(boucle);
    };
    this.anim = requestAnimationFrame(boucle);
  }

  arreter(): void {
    cancelAnimationFrame(this.anim);
  }

  /** Bouton « Passer » : termine la simulation instantanément. */
  passer(): void {
    this.arreter();
    if (!this.cs.termine) simulerJusquAuBout(this.cs);
    if (!this.termine) {
      this.termine = true;
      this.surFin(resultatCombat(this.cs));
    }
  }

  /** géométrie : l'arène (0..1000) est affichée dans un carré centré */
  private geom(): { ech: number; ox: number; oy: number } {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth * dpr;
    const h = this.canvas.clientHeight * dpr;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const cote = Math.min(w, h);
    return { ech: cote / 1000, ox: (w - cote) / 2, oy: (h - cote) / 2 };
  }

  private tap(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { ech, ox, oy } = this.geom();
    const mx = ((e.clientX - r.left) * dpr - ox) / ech;
    const my = ((e.clientY - r.top) * dpr - oy) / ech;
    let meilleur = -1;
    let meilleureDist = 70;
    this.cs.unites.forEach((u, i) => {
      if (!u.vivant || u.equipe !== 1) return;
      const d = Math.hypot(u.x - mx, u.y - my);
      if (d < meilleureDist) {
        meilleureDist = d;
        meilleur = i;
      }
    });
    this.surTapUnite(meilleur);
  }

  private traiterEvts(): void {
    for (const e of this.cs.evts) {
      if (e.type === 'coup') {
        const u = this.cs.unites[e.cibleIdx];
        if (!u) continue;
        this.textes.push({ x: u.x, y: u.y - 50, texte: String(e.deg), couleur: e.crit ? '#ffd54a' : '#ff6b5e', t: 0, grand: e.crit });
        if (e.crit) this.secousse = 0.3;
      } else if (e.type === 'esquive') {
        const u = this.cs.unites[e.cibleIdx];
        if (u) this.textes.push({ x: u.x, y: u.y - 50, texte: 'esquive !', couleur: '#8fd3ff', t: 0 });
      } else if (e.type === 'bloc') {
        const u = this.cs.unites[e.cibleIdx];
        if (u) {
          this.textes.push({ x: u.x, y: u.y - 50, texte: 'BLOQUÉ', couleur: '#cfd8e3', t: 0 });
          this.ronds.push({ x: u.x, y: u.y - 20, rayonMax: 30, couleur: '200,215,235', t: 0, duree: 0.25 });
        }
      } else if (e.type === 'immunise') {
        const u = this.cs.unites[e.cibleIdx];
        if (u) this.textes.push({ x: u.x, y: u.y - 50, texte: 'immunisé', couleur: '#e8e8f5', t: 0 });
      } else if (e.type === 'talent') {
        const u = this.cs.unites[e.idx];
        if (u) {
          this.textes.push({ x: u.x, y: u.y - 78, texte: `✨ ${TALENTS[e.talent].nom}`, couleur: '#ffd54a', t: 0, grand: true });
          if (e.talent === 'fumigene') {
            for (let k = 0; k < 5; k++) {
              this.ronds.push({ x: u.x + (Math.random() - 0.5) * 40, y: u.y - 14 + (Math.random() - 0.5) * 30, rayonMax: 26 + Math.random() * 18, couleur: '170,170,178', t: 0, duree: 0.9 });
            }
          } else if (e.talent === 'dash') {
            this.ronds.push({ x: u.x, y: u.y, rayonMax: 42, couleur: '110,220,255', t: 0, duree: 0.4 });
          } else if (e.talent === 'rage') {
            this.ronds.push({ x: u.x, y: u.y - 14, rayonMax: 52, couleur: '255,70,40', t: 0, duree: 0.6 });
          } else if (e.talent === 'carapace') {
            this.ronds.push({ x: u.x, y: u.y - 14, rayonMax: 48, couleur: '190,200,215', t: 0, duree: 0.6 });
          } else if (e.talent === 'secondevie') {
            this.ronds.push({ x: u.x, y: u.y - 14, rayonMax: 64, couleur: '255,215,90', t: 0, duree: 0.8 });
            this.secousse = Math.max(this.secousse, 0.35);
          }
        }
      } else if (e.type === 'impactProj') {
        if (e.projectile === 'feu') {
          this.ronds.push({ x: e.x, y: e.y, rayonMax: 46, couleur: '255,120,40', t: 0, duree: 0.35 });
          this.textes.push({ x: e.x, y: e.y - 54, texte: String(e.deg), couleur: '#ffab40', t: 0 });
          this.secousse = Math.max(this.secousse, 0.2);
        } else {
          this.ronds.push({ x: e.x, y: e.y, rayonMax: 22, couleur: '230,230,240', t: 0, duree: 0.2 });
          this.textes.push({ x: e.x, y: e.y - 54, texte: String(e.deg), couleur: '#ffe0a3', t: 0 });
        }
      } else if (e.type === 'nova') {
        this.ronds.push({ x: e.x, y: e.y, rayonMax: e.rayon, couleur: '170,90,255', t: 0, duree: 0.55 });
        this.secousse = Math.max(this.secousse, 0.35);
      } else if (e.type === 'soin') {
        const u = this.cs.unites[e.cibleIdx];
        if (u) {
          this.etincelles.push({ x: u.x, y: u.y, t: 0, couleur: '#7bd88a' });
          this.textes.push({ x: u.x, y: u.y - 56, texte: `+${e.pv}`, couleur: '#7bd88a', t: 0 });
        }
      } else if (e.type === 'mort') {
        const u = this.cs.unites[e.cibleIdx];
        if (u) {
          this.textes.push({ x: u.x, y: u.y - 60, texte: 'K.O. !', couleur: '#ff5252', t: 0, grand: true });
          this.secousse = 0.5;
        }
      }
    }
  }

  private frameDe(u: UniteCombat): { anim: string; frame: number } {
    const t = u.animT;
    switch (u.anim) {
      case 'idle':
        return { anim: 'idle', frame: Math.floor(t * 1.6) % 2 };
      case 'walk':
        return { anim: 'walk', frame: Math.floor(t * 9) % 4 };
      case 'attack':
        return { anim: 'attack', frame: Math.min(3, Math.floor((t / 0.45) * 4)) };
      case 'cast':
        return { anim: 'cast', frame: Math.min(3, Math.floor((t / 0.45) * 4)) };
      case 'hit':
        return { anim: 'hit', frame: 0 };
      case 'death':
        return { anim: 'death', frame: t < 0.3 ? 0 : 1 };
    }
  }

  private dirDe(u: UniteCombat): 'S' | 'E' | 'N' | 'W' {
    const a = u.angle;
    const deg = ((a * 180) / Math.PI + 360) % 360;
    if (deg >= 45 && deg < 135) return 'S';
    if (deg >= 135 && deg < 225) return 'W';
    if (deg >= 225 && deg < 315) return 'N';
    return 'E';
  }

  private dessiner(ts: number): void {
    const ctx = this.ctx;
    const { ech, ox, oy } = this.geom();
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.save();
    ctx.fillStyle = '#0d0a06';
    ctx.fillRect(0, 0, W, H);

    // secousse d'écran
    if (this.secousse > 0) {
      ctx.translate((Math.random() - 0.5) * this.secousse * 14, (Math.random() - 0.5) * this.secousse * 14);
      this.secousse = Math.max(0, this.secousse - 0.04);
    }

    ctx.translate(ox, oy);
    ctx.scale(ech, ech);

    // fond d'arène
    const bg = assets.image('arena_bg');
    if (bg) {
      ctx.drawImage(bg, 0, 0, 1000, 1000);
    } else {
      ctx.fillStyle = '#caa96a';
      ctx.beginPath();
      ctx.arc(ARENE.cx, ARENE.cy, ARENE.rayon + 30, 0, Math.PI * 2);
      ctx.fill();
    }

    const focus = this.cs.focus[0];

    // unités triées par y (les mortes d'abord, au sol)
    const ordre = [...this.cs.unites.keys()].sort((a, b) => {
      const ua = this.cs.unites[a]!;
      const ub = this.cs.unites[b]!;
      if (ua.vivant !== ub.vivant) return ua.vivant ? 1 : -1;
      return ua.y - ub.y;
    });

    for (const i of ordre) {
      const u = this.cs.unites[i];
      if (!u) continue;

      // anneau d'équipe sous les pieds + auras de talents
      if (u.vivant) {
        if (u.invincibleT > 0) {
          ctx.globalAlpha = 0.45 + 0.3 * Math.sin(ts * 14);
          ctx.fillStyle = 'rgba(240,240,255,0.5)';
          ctx.beginPath();
          ctx.ellipse(u.x, u.y - 28, 36, 48, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (u.rageActive) {
          ctx.strokeStyle = 'rgba(255,60,30,0.55)';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.ellipse(u.x, u.y + 4, 32, 16, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (u.carapaceActive) {
          ctx.strokeStyle = 'rgba(200,210,225,0.6)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(u.x, u.y + 4, 30, 15, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = u.equipe === 0 ? 'rgba(80,220,120,0.85)' : 'rgba(255,90,70,0.85)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(u.x, u.y + 4, 26, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (i === focus) {
          ctx.strokeStyle = 'rgba(255,215,64,0.95)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(u.x, u.y + 4, 34, 18, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,215,64,0.95)';
          ctx.font = '700 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🎯', u.x, u.y - 86);
        }
      }

      const { anim, frame } = this.frameDe(u);
      ctx.globalAlpha = u.vivant ? 1 : 0.85;
      const ok = assets.dessinerSprite(ctx, u.classe, anim as never, this.dirDe(u), frame, u.x, u.y, 138, u.race);
      if (!ok) {
        ctx.fillStyle = u.equipe === 0 ? '#27ae60' : '#c0392b';
        ctx.beginPath();
        ctx.arc(u.x, u.y - 18, 20, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // barre de PV + nom
      if (u.vivant) {
        const ratio = u.pv / u.pvMax;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(u.x - 26, u.y - 74, 52, 7);
        ctx.fillStyle = ratio > 0.5 ? '#58d068' : ratio > 0.25 ? '#e8b93a' : '#e2574b';
        ctx.fillRect(u.x - 25, u.y - 73, 50 * ratio, 5);
        ctx.font = '600 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(u.nom.split(' ')[0] ?? '', u.x, u.y - 80);
        ctx.shadowBlur = 0;
      }
    }

    // projectiles : boules de feu lumineuses, couteaux et javelots métalliques
    for (const p of this.cs.projectiles) {
      if (p.type === 'feu') {
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 18);
        grad.addColorStop(0, 'rgba(255,240,180,0.95)');
        grad.addColorStop(0.4, 'rgba(255,140,40,0.8)');
        grad.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const long = p.type === 'javelot' ? 30 : 16;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + (p.type === 'couteau' ? this.cs.t * 22 : 0));
        ctx.strokeStyle = '#d9dde6';
        ctx.lineWidth = p.type === 'javelot' ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(-long / 2, 0);
        ctx.lineTo(long / 2, 0);
        ctx.stroke();
        ctx.fillStyle = '#9aa3b2';
        ctx.beginPath();
        ctx.moveTo(long / 2 + 6, 0);
        ctx.lineTo(long / 2 - 3, -4);
        ctx.lineTo(long / 2 - 3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'lighter';

    // effets ronds (nova, impacts)
    this.ronds = this.ronds.filter((r) => r.t < r.duree);
    for (const r of this.ronds) {
      r.t += BALANCE.TICK;
      const k = r.t / r.duree;
      ctx.strokeStyle = `rgba(${r.couleur},${(1 - k) * 0.9})`;
      ctx.lineWidth = 6 * (1 - k) + 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.rayonMax * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(${r.couleur},${(1 - k) * 0.25})`;
      ctx.fill();
    }

    // étincelles de soin
    this.etincelles = this.etincelles.filter((s) => s.t < 0.8);
    for (const s of this.etincelles) {
      s.t += BALANCE.TICK;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + s.t * 3;
        const r = 14 + s.t * 36;
        ctx.fillStyle = s.couleur;
        ctx.globalAlpha = Math.max(0, 1 - s.t / 0.8);
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * r, s.y - 30 - s.t * 40 + Math.sin(a) * r * 0.4, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';

    // textes flottants
    this.textes = this.textes.filter((t) => t.t < 1);
    for (const t of this.textes) {
      t.t += BALANCE.TICK * 1.1;
      ctx.globalAlpha = Math.max(0, 1 - t.t);
      ctx.font = `900 ${t.grand ? 34 : 24}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 5;
      ctx.strokeText(t.texte, t.x, t.y - t.t * 46);
      ctx.fillStyle = t.couleur;
      ctx.fillText(t.texte, t.x, t.y - t.t * 46);
      ctx.globalAlpha = 1;
    }

    // bandeau temps
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(440, 14, 120, 38, 12);
    ctx.fill();
    ctx.fillStyle = '#f0c75e';
    ctx.font = '700 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(0, Math.ceil(BALANCE.COMBAT_DUREE_MAX - this.cs.t))}s`, 500, 41);
    void ts;

    ctx.restore();
  }
}
