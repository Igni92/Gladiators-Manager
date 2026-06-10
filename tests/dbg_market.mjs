import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const serveur = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { cwd: '/home/user/Gladiators-Manager', stdio: 'pipe' });
await new Promise(r => setTimeout(r, 2500));
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true })).newPage();
await page.goto('http://localhost:4174/');
await page.waitForSelector('[data-testid="btn-nouvelle"]');
await page.tap('[data-testid="btn-nouvelle"]');
await page.tap('[data-testid="btn-commencer"]');
await page.waitForSelector('[data-testid="ecran-ville"]');
await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
// tap marché
const pos = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="canvas-ville"]');
  const r = c.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const ech = Math.max((r.width * dpr) / 1000, (r.height * dpr) / 1500);
  const dx = (r.width * dpr - 1000 * ech) / 2; const dy = (r.height * dpr - 1500 * ech) / 2;
  return { x: r.left + (205 * ech + dx) / dpr, y: r.top + (640 * ech + dy) / dpr };
});
await page.touchscreen.tap(pos.x, pos.y);
await page.waitForSelector('[data-testid="ecran-marche"]');
const infos = await page.evaluate(() => {
  return [...document.querySelectorAll('.grille-cartes > div')].map(w => ({
    enfants: w.children.length,
    c1: w.children[0]?.className,
    c2: w.children[1]?.textContent,
    c3: w.children[2]?.textContent,
  }));
});
console.log(JSON.stringify(infos, null, 1));
await b.close(); serveur.kill();
