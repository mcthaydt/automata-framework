import { createRequire } from 'node:module';
const require = createRequire('/home/user/pixijs3d_experiment_001/package.json');
const { chromium } = require('playwright');
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--headless', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const spots = [
  { name: 'hall-south', x: 0.6, z: 6.5, facing: 0 },
  { name: 'corridor', x: 0, z: -4, facing: 0 },
  { name: 'closet', x: 3.1, z: -4.6, facing: 0 },
];
const results = {};
for (const [w, h] of [[1024, 768], [844, 390]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5197/?debug&renderer=webgl&scene=prologue&framing=on&scale=letterbox&crew=off');
  await page.waitForFunction(() => window.game && !document.querySelector('#begin').hidden, null, { timeout: 240000 });
  await page.click('#begin');
  await page.evaluate(async () => {
    window.game.skip(); window.game.session.endDialogue();
    const source = await (await fetch('/src/render/stage.ts')).text();
    const url = source.match(/from\s*["']([^"']+@pixi_3d[^"']*)["']/)[1];
    const { Camera3D } = await import(url);
    const original = Camera3D.prototype.lookAt;
    Camera3D.prototype.lookAt = function (target, ...args) {
      window.__camera = { pos: [this.position.x, this.position.y, this.position.z], look: [target.x, target.y, target.z], fov: this.fov };
      return original.call(this, target, ...args);
    };
    const w = window.game.simulation.world(); w.sighted = true; if (w.nurse) { w.nurse.mode = 'dormant'; w.nurse.path = []; }
  });
  for (const s of spots) {
    await page.evaluate(({ x, z, facing }) => { window.game.place(x, z, facing); window.game.step(240); }, s);
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => ({ camera: window.__camera, ada: window.game.adaScreen(), pose: window.game.simulation.pose(),
      canvas: (() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { w: c.width, h: c.height, css: [r.left, r.top, r.width, r.height] }; })() }));
    results[`${w}x${h}/${s.name}`] = info;
    await page.screenshot({ path: `${out}/${w}x${h}-${s.name}.png` });
  }
  results[`${w}x${h}/errors`] = errors;
  await page.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
