/** Petits utilitaires DOM (création d'éléments, formats français). */

type Attrs = Record<string, string | number | boolean | ((e: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...enfants: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2), v as EventListener);
      } else if (k === 'class') {
        node.className = String(v);
      } else if (v !== false && v !== undefined) {
        node.setAttribute(k, String(v));
      }
    }
  }
  for (const enfant of enfants) {
    if (enfant === null || enfant === undefined) continue;
    node.append(enfant instanceof Node ? enfant : document.createTextNode(enfant));
  }
  return node;
}

/** Icône 3D pré-rendue (assets/icons/*.png). */
export function icone(nom: string, taille = 18): HTMLImageElement {
  const img = el('img', {
    class: 'ico',
    src: `${import.meta.env.BASE_URL}assets/icons/${nom}.png`,
    alt: nom,
    style: `width:${taille}px;height:${taille}px;`,
  }) as HTMLImageElement;
  return img;
}

/** 12 345 → « 12 345 PO » */
export function fmtPO(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} PO`;
}

export function fmtNombre(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

export function fmtSigne(n: number): string {
  const v = Math.round(n);
  return v > 0 ? `+${v.toLocaleString('fr-FR')}` : v.toLocaleString('fr-FR');
}

let conteneurToasts: HTMLElement | null = null;

/** Petit message furtif en bas de l'écran. */
export function toast(texte: string, duree = 2600): void {
  if (!conteneurToasts || !document.body.contains(conteneurToasts)) {
    conteneurToasts = el('div', { class: 'toasts' });
    document.body.append(conteneurToasts);
  }
  const t = el('div', { class: 'toast' }, texte);
  conteneurToasts.append(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 400);
  }, duree);
}

/** Affiche une file de messages (résumé de fin de semaine). */
export function toasts(messages: string[]): void {
  messages.forEach((m, i) => setTimeout(() => toast(m, 3200), i * 650));
}

/** Modale générique ; renvoie une fonction de fermeture. */
export function modale(contenu: HTMLElement, opts: { fermable?: boolean } = {}): () => void {
  const fond = el('div', { class: 'modale-fond' });
  const boite = el('div', { class: 'modale' }, contenu);
  fond.append(boite);
  document.body.append(fond);
  const fermer = () => fond.remove();
  if (opts.fermable !== false) {
    fond.addEventListener('click', (e) => {
      if (e.target === fond) fermer();
    });
  }
  return fermer;
}
