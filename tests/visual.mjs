/**
 * Test visuel headless au format iPhone (430×932) — `npm run test:visual`
 * Parcourt : titre → nouvelle partie → ville → marché (transfert complet
 * négocié) → caserne/taverne/banque/infirmerie/équipe → arène → combat 3v3
 * avec consignes → résultat. Capture chaque écran et échoue à la moindre
 * erreur JavaScript.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'tests', 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const PORT = 4173;

function attendre(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// serveur de prévisualisation (dist/)
const serveur = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: 'pipe',
});
await attendre(2500);

const erreurs = [];
let navigateur;
try {
  navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(`console.error: ${m.text()}`);
  });

  const shot = async (nom) => {
    await page.screenshot({ path: join(SHOTS, `${nom}.png`) });
    console.log(`📸 ${nom}`);
  };

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('[data-testid="ecran-titre"]', { timeout: 15000 });
  await attendre(600);
  await shot('01-titre');

  // ----- nouvelle partie
  await page.tap('[data-testid="btn-nouvelle"]');
  await page.waitForSelector('[data-testid="btn-commencer"]');
  await page.tap('[data-testid="btn-commencer"]');
  await page.waitForSelector('[data-testid="ecran-ville"]');
  // tutoriel de première partie : capture puis fermeture
  await page.waitForSelector('[data-testid="tuto"]', { timeout: 8000 });
  await attendre(400);
  await shot('02a-tuto');
  for (let i = 0; i < 6; i++) {
    const visible = await page.locator('[data-testid="tuto-suivant"]').isVisible().catch(() => false);
    if (!visible) break;
    await page.tap('[data-testid="tuto-suivant"]');
    await attendre(250);
  }
  await attendre(600);
  await shot('02-ville');

  // helper : tape un bâtiment de la ville (coordonnées de render/ville.ts)
  const BATIMENTS = {
    arene: { x: 500, y: 300 },
    marche: { x: 205, y: 640 },
    caserne: { x: 800, y: 640 },
    taverne: { x: 195, y: 1010 },
    banque: { x: 805, y: 1010 },
    infirmerie: { x: 500, y: 1300 },
  };
  const tapBatiment = async (id) => {
    await page.waitForSelector('[data-testid="canvas-ville"]');
    const pos = await page.evaluate((carte) => {
      const c = document.querySelector('[data-testid="canvas-ville"]');
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const ech = Math.max((r.width * dpr) / 1000, (r.height * dpr) / 1500);
      const dx = (r.width * dpr - 1000 * ech) / 2;
      const dy = (r.height * dpr - 1500 * ech) / 2;
      return { x: r.left + (carte.x * ech + dx) / dpr, y: r.top + (carte.y * ech + dy) / dpr };
    }, BATIMENTS[id]);
    await page.touchscreen.tap(pos.x, pos.y);
  };

  // ----- marché : transfert complet (négociation prix + salaire)
  await tapBatiment('marche');
  await page.waitForSelector('[data-testid="ecran-marche"]');
  await attendre(400);
  await shot('03-marche');

  // choisit la carte la moins chère (lecture des prix dans le DOM)
  const idxMoinsCher = await page.evaluate(() => {
    const wrappers = [...document.querySelectorAll('.grille-cartes > div')];
    let meilleur = -1;
    let prixMin = Infinity;
    wrappers.forEach((w, i) => {
      const prix = Number((w.children[1]?.textContent ?? '').replace(/[^\d]/g, ''));
      if (prix > 0 && prix < prixMin) {
        prixMin = prix;
        meilleur = i;
      }
    });
    return meilleur;
  });
  if (idxMoinsCher < 0) {
    erreurs.push('marché : aucune annonce trouvée');
  } else {
    await page.locator('.grille-cartes > div').nth(idxMoinsCher).locator('.carte-glad').tap();
    await page.waitForSelector('[data-testid="curseur-prix"]');
    await shot('04-negociation');
    // offre au maximum du curseur → prix accepté ; salaire par défaut = exigence
    for (let essai = 0; essai < 3; essai++) {
      const visible = await page.locator('[data-testid="btn-proposer"]').isVisible().catch(() => false);
      if (!visible) break;
      await page.locator('[data-testid="curseur-prix"]').evaluate((el) => {
        el.value = el.max;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.tap('[data-testid="btn-proposer"]');
      await attendre(900);
    }
    const effectif = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('gladiators_manager_save_v1') ?? '{}');
      return save?.equipes?.[0]?.gladiateurIds?.length ?? 0;
    });
    if (effectif < 6) erreurs.push(`transfert : l'effectif n'est pas passé à 6 (${effectif})`);
  }
  await shot('05-marche-apres-transfert');

  // ----- caserne : programme d'entraînement
  await page.tap('.btn-retour');
  await page.waitForSelector('[data-testid="ecran-ville"]');
  await tapBatiment('caserne');
  await page.waitForSelector('[data-testid="ecran-caserne"]');
  const chip = page.locator('.chips .chip').nth(2);
  await chip.tap().catch(() => {});
  await attendre(300);
  await shot('06-caserne');

  // ----- taverne
  await page.tap('.btn-retour');
  await tapBatiment('taverne');
  await page.waitForSelector('[data-testid="ecran-taverne"]');
  await shot('07-taverne');

  // taux d'apparition visibles à la taverne
  const tauxSS = await page.locator('[data-testid="taux-SS"]').count();
  if (tauxSS === 0) erreurs.push('taverne : tableau des chances d’apparition absent');

  // ----- banque
  await page.tap('.btn-retour');
  await tapBatiment('banque');
  await page.waitForSelector('[data-testid="ecran-banque"]');
  await attendre(300);
  await shot('08-banque');

  // ----- infirmerie
  await page.tap('.btn-retour');
  await tapBatiment('infirmerie');
  await page.waitForSelector('[data-testid="ecran-infirmerie"]');
  await shot('09-infirmerie');

  // ----- équipe (cartes FIFA) + fiche
  await page.tap('.btn-retour');
  await page.tap('[data-testid="btn-equipe"]');
  await page.waitForSelector('[data-testid="ecran-equipe"]');
  await attendre(400);
  await shot('10-equipe');
  await page.locator('.grille-cartes .carte-glad').first().tap();
  await attendre(400);
  await shot('11-fiche-gladiateur');
  await page.tap('.modale-fond', { position: { x: 10, y: 10 } });

  // ----- avancer jusqu'à la semaine 3 (1re journée de ligue)
  await page.tap('.btn-retour');
  await page.waitForSelector('[data-testid="btn-semaine-suivante"]');
  await page.tap('[data-testid="btn-semaine-suivante"]');
  await attendre(700);
  await page.tap('[data-testid="btn-semaine-suivante"]');
  await attendre(900);

  // ----- arène : classement
  await tapBatiment('arene');
  await page.waitForSelector('[data-testid="ecran-arene"]');
  await page.tap('[data-testid="onglet-classement"]');
  await attendre(300);
  await shot('12-classement');
  await page.tap('[data-testid="onglet-calendrier"]');
  await attendre(300);
  await shot('13-calendrier');

  // ----- match de ligue : sélection → combat avec consignes → résultat
  await page.tap('[data-testid="onglet-match"]');
  await page.waitForSelector('[data-testid="btn-jouer"]');
  await page.tap('[data-testid="btn-jouer"]');
  await page.waitForSelector('[data-testid="ecran-selection"]');
  await attendre(500);
  await shot('14-selection-equipe');
  await page.tap('[data-testid="btn-combattre"]');
  // phase de placement façon AFK Arena
  await page.waitForSelector('[data-testid="ecran-placement"]');
  await attendre(600);
  await shot('14b-placement');
  // déplace le gladiateur sélectionné vers la colonne arrière (slot 5 : ligne milieu, col 2)
  await page.locator('[data-testid="place-glad-0"]').tap();
  const posSlot = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="canvas-placement"]');
    const r = c.getBoundingClientRect();
    const ech = r.width / 1000;
    // slot 5 → col 2, ligne 1 → x = 500-330=170... coordonnées via la formule du jeu
    const dx = 130 + 2 * 100;
    return { x: r.left + (500 - dx) * ech, y: r.top + 500 * ech };
  });
  await page.touchscreen.tap(posSlot.x, posSlot.y);
  await attendre(400);
  await page.tap('[data-testid="btn-lancer-combat"]');
  await page.waitForSelector('[data-testid="canvas-combat"]');
  await attendre(2600);
  await page.tap('[data-testid="consigne-agressif"]');
  await attendre(1800);
  await shot('15-combat');
  await page.tap('[data-testid="consigne-magie"]');
  await attendre(2200);
  await shot('16-combat-suite');
  await page.tap('[data-testid="btn-passer"]');
  await page.waitForSelector('[data-testid="ecran-resultat"]', { timeout: 10000 });
  await attendre(500);
  await shot('17-resultat');
  await page.tap('[data-testid="btn-continuer"]');
  await page.waitForSelector('[data-testid="ecran-ville"]');

  // ----- rechargement : la sauvegarde doit proposer « Continuer »
  await page.reload();
  await page.waitForSelector('[data-testid="btn-continuer"]', { timeout: 15000 });
  await page.tap('[data-testid="btn-continuer"]');
  await page.waitForSelector('[data-testid="ecran-ville"]');
  console.log('💾 sauvegarde/chargement OK');

  await navigateur.close();
} catch (e) {
  erreurs.push(`test: ${e.message}`);
  try {
    await navigateur?.close();
  } catch {}
}

serveur.kill();

if (erreurs.length > 0) {
  console.error('\n❌ ERREURS :');
  for (const e of erreurs) console.error(' -', e);
  process.exit(1);
}
console.log('\n✓ Test visuel réussi, aucune erreur JavaScript.');
// vite preview (enfant de npx) survit parfois au kill : on sort explicitement
process.exit(0);
