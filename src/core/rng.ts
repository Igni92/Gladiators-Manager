/** Générateur pseudo-aléatoire seedé (mulberry32) : reproductible pour la simu d'équilibrage. */
export class RNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** flottant [0,1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** entier [min, max] inclus */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** flottant [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** vrai avec probabilité p (0..1) */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** élément aléatoire d'un tableau (non vide) */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)] as T;
  }

  /** approx. gaussienne centrée 0, écart-type 1 (somme de 3 uniformes) */
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }

  /** mélange en place (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = tmp;
    }
    return arr;
  }

  /** graine dérivée (pour sous-systèmes indépendants) */
  fork(): RNG {
    return new RNG(Math.floor(this.next() * 4294967296));
  }
}
