/**
 * Checks the Pixi 3D view against the painter (npm run view-check [-- OUT_DIR]).
 *
 * 1. The standing views (viewer/main.ts, `?check=D`): each base figure in each of the 8 views under an orthographic
 *    camera at the sheets' 18°, a texel to a pixel, in headless Chromium; every pixel the figure covers must be the
 *    sheets' cell's (frames.ts `standing`), texel for texel, and no pixel outside it may be drawn.
 * 2. The stage cases (viewer/cases.ts, `?case=NAME`): `StageView` draws the case's `StageFrame` and the readback is
 *    compared with `compose(frame)` computed here. `bytes` cases: every byte equal. `palette` cases: alpha 0 or 255
 *    only, and every opaque pixel a colour some sprite's cell holds.
 * 3. Determinism: `scene4` drawn twice in one page load (`&twice`) and once in a fresh one, all three readbacks equal.
 *
 * `ONLY=<regex>` limits the run to the stage cases whose name matches (and skips 1 and 3), for working on one.
 *
 * Exits non-zero on any difference or page error. With OUT_DIR, also writes a CPU and a GPU PNG of the cases the gate
 * sheet shows (`/` in a name written `_`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { BASE, compose, member, standing } from '../src';
import { CASES } from '../viewer/cases';

const out = process.argv[2] ? resolve(process.argv[2]) : null;
if (out) mkdirSync(out, { recursive: true });
const server = await createServer({ root: resolve(import.meta.dirname, '../viewer'), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls!.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
/** The page's canvas as RGBA, read back through a 2D canvas (a WebGL canvas kept with `preserveDrawingBuffer`). */
async function readback(p: Page): Promise<{ w: number; h: number; rgba: Buffer }> {
  const shot = await p.evaluate(() => {
    const c = document.querySelector('canvas')!, copy = document.createElement('canvas');
    copy.width = c.width; copy.height = c.height;
    const g = copy.getContext('2d')!; g.drawImage(c, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let bin = '';
    for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode(...d.subarray(i, i + 0x8000));
    return { w: c.width, h: c.height, b64: btoa(bin) };
  });
  return { w: shot.w, h: shot.h, rgba: Buffer.from(shot.b64, 'base64') };
}
/** Draws a stage case on the page and reads it back. */
async function draw(name: string, query = ''): Promise<{ w: number; h: number; rgba: Buffer }> {
  await page.goto(`${url}?case=${encodeURIComponent(name)}${query}`);
  await page.waitForSelector('body[data-ready]', { timeout: 120_000 });
  return readback(page);
}
/** The cases the gate sheet shows. */
const KEEP = new Set(['day', 'lit', 'zoom/1', 'zoom/3', 'gameplay/crisp/1', 'gameplay/true/1']);
const png = (rgba: ArrayLike<number>, w: number, h: number) => {
  const c = createCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  img.data.set(rgba as Uint8ClampedArray); ctx.putImageData(img, 0, 0);
  return c.toBuffer('image/png');
};
const at = (i: number, w: number) => `(${(i >> 2) % w}, ${Math.floor((i >> 2) / w)})`;
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
let failed = 0;
try {
  for (const [who, b] of only ? [] : BASE.entries()) {
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
  // The stage cases.
  for (const [name, c] of Object.entries(CASES)) {
    if (only && !only.test(name)) continue;
    const frame = c.frame(), want = compose(frame), [W, H] = frame.camera.size, got = await draw(name);
    if (out && KEEP.has(name)) {
      writeFileSync(join(out, `${name.replace(/\//g, '_')}.gpu.png`), png(got.rgba, W, H));
      writeFileSync(join(out, `${name.replace(/\//g, '_')}.cpu.png`), png(want, W, H));
    }
    if (got.w !== W || got.h !== H) { console.log(`${name}: canvas ${got.w}×${got.h}, frame ${W}×${H}`); failed++; continue; }
    if (c.claim === 'bytes') {
      let wrong = 0, first = -1;
      for (let i = 0; i < want.length; i += 4) if (want[i] !== got.rgba[i] || want[i + 1] !== got.rgba[i + 1] || want[i + 2] !== got.rgba[i + 2] || want[i + 3] !== got.rgba[i + 3]) { wrong++; if (first < 0) first = i; }
      console.log(`${name}: ${wrong === 0 ? 'identical' : `${wrong} pixels differ, first ${at(first, W)} cpu ${Array.from(want.slice(first, first + 4))} gpu ${Array.from(got.rgba.subarray(first, first + 4))}`}`);
      if (wrong) failed++;
    } else {
      const held = new Set<number>();
      for (const s of frame.sprites) for (let i = 0; i < s.cell.rgba.length; i += 4) if (s.cell.rgba[i + 3]) held.add(s.cell.rgba[i] << 16 | s.cell.rgba[i + 1] << 8 | s.cell.rgba[i + 2]);
      let bad = '';
      for (let i = 0; i < got.rgba.length && !bad; i += 4) {
        const a = got.rgba[i + 3], rgb = got.rgba[i] << 16 | got.rgba[i + 1] << 8 | got.rgba[i + 2];
        if (a !== 0 && a !== 255) bad = `alpha ${a} at ${at(i, W)}`;
        else if (a === 255 && !held.has(rgb)) bad = `new colour #${rgb.toString(16).padStart(6, '0')} at ${at(i, W)}`;
      }
      console.log(`${name}: ${bad ? `palette broken: ${bad}` : 'palette holds'}`);
      if (bad) failed++;
    }
  }
  // Determinism: scene4 twice in one page load, and once in a fresh one.
  if (!only) {
    const once = await draw('scene4'), twice = await draw('scene4', '&twice'), fresh = await draw('scene4');
    const same = Buffer.compare(once.rgba, twice.rgba) === 0 && Buffer.compare(once.rgba, fresh.rgba) === 0;
    console.log(`scene4: ${same ? 'deterministic' : 'readbacks differ between draws'}`);
    if (!same) failed++;
  }
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) { console.log(errors.join('\n')); failed++; }
process.exit(failed ? 1 : 0);
