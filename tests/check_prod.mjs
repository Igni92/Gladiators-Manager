import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text()); });
const reponses404 = [];
page.on('response', (r) => { if (r.status() >= 400) reponses404.push(`${r.status()} ${r.url()}`); });
await page.goto('https://igni92.github.io/Gladiators-Manager/', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForSelector('[data-testid="ecran-titre"]', { timeout: 20000 });
await page.tap('[data-testid="btn-nouvelle"]');
await page.waitForSelector('[data-testid="btn-commencer"]');
await page.tap('[data-testid="btn-commencer"]');
await page.waitForSelector('[data-testid="ecran-ville"]');
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: 'tests/screenshots/00-production-ville.png' });
await b.close();
if (erreurs.length || reponses404.length) {
  console.error('ERREURS PROD :', erreurs, reponses404);
  process.exit(1);
}
console.log('✓ PRODUCTION OK : titre + nouvelle partie + ville sans erreur sur l’URL publique');
