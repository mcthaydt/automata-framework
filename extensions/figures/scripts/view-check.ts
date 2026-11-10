/**
 * Checks the Pixi 3D view against the painter: for each base figure in each of the 8 views, the viewer's check page
 * (viewer/main.ts, `?check=D`) draws the figure's quad under an orthographic camera at the sheets' 18°, a texel to a
 * pixel, in headless Chromium, and every pixel the figure covers must be the sheets' cell's (frames.ts `standing`),
 * texel for texel; and no pixel outside the figure may be drawn. Exits non-zero on any difference.
 *
 *   npm run view-check [-- OUT_DIR]     (OUT_DIR: also writes each view's canvas as a PNG)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { BASE, member, standing } from '../src';

const out = process.argv[2] ? resolve(process.argv[2]) : null;
if (out) mkdirSync(out, { recursive: true });
const server = await createServer({ root: resolve(import.meta.dirname, '../viewer'), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls!.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
let failed = 0;
try {
  for (const [who, b] of BASE.entries()) {
    const cast = member(b.def, 2), [w, h] = cast.cell;
    for (let d = 0; d < 8; d++) {
      await page.goto(`${url}?check=${d}&who=${who}`);
      await page.waitForSelector('body[data-ready]', { timeout: 60_000 });
      const shot = await page.evaluate(() => {
        const c = document.querySelector('canvas')!, copy = document.createElement('canvas');
        copy.width = c.width; copy.height = c.height;
        const g = copy.getContext('2d')!; g.drawImage(c, 0, 0);
        return { w: c.width, h: c.height, px: Array.from(g.getImageData(0, 0, c.width, c.height).data), png: copy.toDataURL('image/png') };
      });
      if (out) writeFileSync(join(out, `${b.def.id}-view${d}.png`), Buffer.from(shot.png.split(',')[1], 'base64'));
      const cell = standing(cast, d);
      if (shot.w !== w || shot.h !== h) { console.log(`${b.def.id} view ${d}: canvas ${shot.w}×${shot.h}, cell ${w}×${h}`); failed++; continue; }
      let wrong = 0, first = '';
      for (let i = 0; i < w * h; i++) {
        const a = cell[i * 4 + 3] > 0, drawn = shot.px[i * 4 + 3] > 0;
        const same = a ? drawn && [0, 1, 2].every(k => cell[i * 4 + k] === shot.px[i * 4 + k]) : !drawn;
        if (!same) { wrong++; if (!first) first = `(${i % w}, ${Math.floor(i / w)}) cell ${Array.from(cell.slice(i * 4, i * 4 + 4))} drawn ${shot.px.slice(i * 4, i * 4 + 4)}`; }
      }
      console.log(`${b.def.id} view ${d}: ${wrong === 0 ? 'identical' : `${wrong} pixels differ, first ${first}`}`);
      if (wrong) failed++;
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) { console.log(errors.join('\n')); failed++; }
process.exit(failed ? 1 : 0);
