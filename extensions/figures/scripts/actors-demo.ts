/**
 * The actors' contact sheet (docs/actors.md): every action in the library on the base pair, at five moments of its
 * envelope (its start, its wind-up, its strike, its end and half its recovery), then the run, the strafe and stepping
 * in place, at D2, with a base-m standing by as the target of a point or a handshake. Writes into OUT_DIR
 * actions-sheet.png and actions-sheet-x2.png (×2 nearest).
 *
 *   npm run actors -- [OUT_DIR]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { ACTIONS, actionOf, lengthOf, Troupe, view as sheetView, type ActionCue, type ActorScript } from '../src/index';

const out = resolve(process.argv[2] ?? 'out/actors');
mkdirSync(out, { recursive: true });
/** The density the sheet is drawn at, and the base figures every row is shown on. */
const D = 2, WHO = ['base-m', 'base-f'];
const IDS = Object.keys(ACTIONS).filter(id => !('alias' in ACTIONS[id]));
const HOLDS = new Set(IDS.filter(id => actionOf(id, false, false).def.hold));

const save = (c: Canvas, file: string) => writeFileSync(file, c.toBuffer('image/png'));
function rgbaCanvas(px: Uint8ClampedArray, w: number, h: number) {
  const c = createCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  img.data.set(px); ctx.putImageData(img, 0, 0);
  return c;
}

const view = sheetView(), W = 64 * D, H = 96 * D, N = 5, LABEL = 70, PAD = 6;
const rows: { label: string; script: (who: string) => ActorScript; at: number[] }[] = IDS.map(id => {
  const { def } = actionOf(id, false, false), hold = HOLDS.has(id) ? 0.8 : 0, len = lengthOf(def) + hold, t0 = 0.2;
  const cue: ActionCue = { t: t0, action: id, ...(hold ? { until: t0 + len } : {}), ...(def.targeted ? { at: 'other' } : {}) };
  const strike = def.keys.find(k => k[0] > def.anticipation + 0.01)?.[0] ?? def.anticipation + def.action / 2;
  return { label: id, script: who => ({ who, at: [0, 0], facing: 35, actions: [cue], items: id === 'swing' ? [{ t: 0, hold: 'torch' }] : [] }), at: [t0 + 0.01, t0 + def.anticipation, t0 + Math.min(strike, len), t0 + len, t0 + len + def.recovery * 0.5] };
});
rows.push(
  { label: 'run', script: who => ({ who, at: [0, 0], path: [{ at: [6, 6], run: true }] }), at: [0.05, 0.12, 0.19, 0.26, 0.33] },
  { label: 'strafe', script: who => ({ who, at: [0, 0], facing: 0, path: [{ at: [4, 0], strafe: true }] }), at: [0.1, 0.25, 0.4, 0.55, 0.7] },
  { label: 'march', script: who => ({ who, at: [0, 0], facing: 35, path: [{ at: [0, 0.001], march: 3 }] }), at: [0.1, 0.25, 0.4, 0.55, 0.7] },
);
const sheet = createCanvas(LABEL + WHO.length * (N * W + PAD), rows.length * H), ctx = sheet.getContext('2d');
ctx.fillStyle = '#5b5c69'; ctx.fillRect(0, 0, sheet.width, sheet.height); ctx.imageSmoothingEnabled = false;
rows.forEach((row, r) => {
  ctx.fillStyle = '#eadbc9'; ctx.font = '13px sans-serif'; ctx.fillText(row.label, 4, r * H + H / 2);
  WHO.forEach((who, c) => {
    const troupe = new Troupe();
    troupe.add({ name: 'other', who: 'base-m', at: [1.2, 1.4] });
    const a = troupe.add(row.script(who), { density: D });
    row.at.forEach((t, i) => ctx.drawImage(rgbaCanvas(a.draw(t, view).painted, W, H), LABEL + c * (N * W + PAD) + i * W, r * H));
  });
});
save(sheet, join(out, 'actions-sheet.png'));
const big = createCanvas(sheet.width * 2, sheet.height * 2), bc = big.getContext('2d');
bc.imageSmoothingEnabled = false; bc.drawImage(sheet, 0, 0, big.width, big.height); save(big, join(out, 'actions-sheet-x2.png'));
console.log(join(out, 'actions-sheet.png'), `${rows.length} rows`);
