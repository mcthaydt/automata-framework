/**
 * The base pair lit (src/features/lighting): a contact sheet of a few lighting setups, one row each (daylight; golden
 * hour; dusk under a spot; night under a warm lamp with the floor's bounce; a bar's two lamps, one flickering), each
 * base figure in three views (front, three-quarter, side), at D2. Writes OUT_DIR/lit-sheet.png and lit-sheet-x2.png.
 *
 *   npm run lit -- [OUT_DIR]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { BASE, Figure, lightFigure, member, TIMES, view, type Lighting } from '../src';

const out = resolve(process.argv[2] ?? 'out/lit');
mkdirSync(out, { recursive: true });
const D = 2, VIEWS = [0, 1, 2], W = 64 * D, H = 96 * D, LABEL = 90;
const warm = '#ffbc4e', cool = '#4ea6ff';
/** The setups, one row each: a time from the library, and lamps in the figure's space (m from its feet). */
const ROWS: [string, Lighting][] = [
  ['day', { time: TIMES.day, lamps: [] }],
  ['golden', { time: TIMES.golden, lamps: [] }],
  ['dusk spot', { time: TIMES.dusk, lamps: [{ at: [0.4, 3, 1.2], color: '#eadbc9', steps: 3, radius: 4.5, aim: [-0.1, -1, -0.3], cone: 30 }] }],
  ['night lamp', { time: TIMES.night, lamps: [{ at: [-1.2, 1.5, 0.8], color: warm, steps: 3, radius: 3.2, tint: 0.4 }], bounce: { floor: 0x5b5c69 } }],
  ['bar', { time: TIMES.bar, t: 1.25, lamps: [{ at: [-1.5, 1.8, 1], color: warm, steps: 2, radius: 3.5 }, { at: [1.4, 1.2, -0.6], color: cool, steps: 2, radius: 2.6, flicker: 0.5, seed: 3 }], bounce: { floor: 0x3d5083, glow: 0x4ea6ff, side: 1 } }],
];
const sheet = createCanvas(LABEL + BASE.length * VIEWS.length * W, ROWS.length * H), ctx = sheet.getContext('2d');
ctx.fillStyle = '#1d1d21'; ctx.fillRect(0, 0, sheet.width, sheet.height);
ROWS.forEach(([label, lighting], r) => {
  ctx.fillStyle = '#eadbc9'; ctx.font = '13px sans-serif'; ctx.fillText(label, 4, r * H + H / 2);
  BASE.forEach((c, b) => VIEWS.forEach((d, i) => {
    const f = new Figure(member(c.def, D));
    for (let k = 0; k < 3; k++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view() });
    const cell = createCanvas(W, H), cc = cell.getContext('2d'), img = cc.createImageData(W, H);
    img.data.set(lightFigure(f, lighting)); cc.putImageData(img, 0, 0);
    ctx.drawImage(cell, LABEL + (b * VIEWS.length + i) * W, r * H);
  }));
});
writeFileSync(join(out, 'lit-sheet.png'), sheet.toBuffer('image/png'));
const big = createCanvas(sheet.width * 2, sheet.height * 2), bc = big.getContext('2d');
bc.imageSmoothingEnabled = false; bc.drawImage(sheet, 0, 0, big.width, big.height);
writeFileSync(join(out, 'lit-sheet-x2.png'), big.toBuffer('image/png'));
console.log(join(out, 'lit-sheet.png'), `${ROWS.length} rows`);
