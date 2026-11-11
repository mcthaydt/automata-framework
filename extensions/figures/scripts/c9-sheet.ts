/**
 * c9-wardrobe's checkpoint sheets (docs/superpowers/plans/2026-11-11-c9-wardrobe.md), drawn in Node. Free: no API.
 *
 *   npm run c9 -- <out> [name…]     writes <out>/<name>.png (1×) and <name>-x8.png for each named sheet (all, if none)
 *   npm run c9 -- <out> --measure   prints the numbers the badge, the watch and the faces are sized from (spec 5.5)
 *
 * A sheet is `{ name, rows, views, walk, density }`: one row per entry, its views standing from left to right (0 the
 * front, counter-clockwise by 45°) and then, if `walk`, the poses of its walk (three-quarter front). A row is a character
 * (a base figure in some dress: data) and, optionally, the figure's input (an expression, the mood tags) and its own
 * density. Each task of the plan adds its sheet to SHEETS. The ×8 image has the rows' labels in a gutter on its left;
 * `<name>.txt` lists them too, top to bottom.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { BASE, Figure, SPRITE_PITCH, member, view, walking, type CharacterDef, type Frame, type FigureInput } from '../src';
import { GROUP } from '../src/features/body/parts';
import { measure } from '../src/features/body/genes';
import { J, skeleton } from '../src/features/body/rig';
import { bodyOf } from '../src/features/outfit/fit';

/** One row of a sheet: a character, what the figure is told (an expression, mood tags), and its own density if not the sheet's. */
export interface Row { label: string; def: CharacterDef; input?: Partial<FigureInput>; density?: number }
export interface Sheet { name: string; rows: Row[]; views: number[]; walk: boolean; density: number }

const ZOOM = 8, GUTTER = 150, ALL_VIEWS = [0, 1, 2, 3, 4, 5, 6, 7];
/** The base pair as they are, each a row of `rows(def)`-many variants (a sheet builds each figure's rows from its def). */
export const pair = (rows: (def: CharacterDef, who: string) => Row[]): Row[] => BASE.flatMap(b => rows(b.def, b.def.id));

/** The sheets, in the order the plan makes them. */
export const SHEETS: Sheet[] = [
  { name: 'before', rows: pair((def, who) => [{ label: `${who} as they are`, def }]), views: ALL_VIEWS, walk: true, density: 2 },
];

/** A row's frames: its views standing, then its walk's poses. */
function frames(row: Row, sheet: Sheet): { px: Frame; w: number; h: number }[] {
  const cast = member(row.def, row.density ?? sheet.density), [w, h] = cast.cell, out: { px: Frame; w: number; h: number }[] = [];
  for (const d of sheet.views) {
    const f = new Figure(cast);
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view(SPRITE_PITCH), clock: 0, ...row.input });
    out.push({ px: f.painted.slice(), w, h });
  }
  if (sheet.walk) for (const px of walking(cast, SPRITE_PITCH)) out.push({ px, w, h });
  return out;
}

/** Draws a sheet: the rows stacked, their frames side by side, 1× then ×8 (labels in the ×8's gutter). */
function draw(sheet: Sheet, out: string) {
  const rows = sheet.rows.map(r => ({ r, f: frames(r, sheet) }));
  const W = Math.max(...rows.map(({ f }) => f.reduce((n, x) => n + x.w, 0))), rowH = rows.map(({ f }) => Math.max(...f.map(x => x.h)));
  const H = rowH.reduce((a, b) => a + b, 0), c = createCanvas(W, H), ctx = c.getContext('2d');
  let y = 0;
  rows.forEach(({ f }, i) => {
    let x = 0;
    for (const { px, w, h } of f) { const img = ctx.createImageData(w, h); img.data.set(px); ctx.putImageData(img, x, y); x += w; }
    y += rowH[i];
  });
  writeFileSync(join(out, `${sheet.name}.png`), c.toBuffer('image/png'));
  const big = createCanvas(W * ZOOM + GUTTER, H * ZOOM), bc = big.getContext('2d');
  bc.fillStyle = '#20202a'; bc.fillRect(0, 0, big.width, big.height);
  bc.imageSmoothingEnabled = false; bc.drawImage(c, 0, 0, W, H, GUTTER, 0, W * ZOOM, H * ZOOM);
  bc.fillStyle = '#e8e8f0'; bc.font = '14px sans-serif';
  let top = 0;
  rows.forEach(({ r }, i) => { bc.fillText(r.label.slice(0, 22), 6, top * ZOOM + 18); top += rowH[i]; });
  writeFileSync(join(out, `${sheet.name}-x${ZOOM}.png`), big.toBuffer('image/png'));
  writeFileSync(join(out, `${sheet.name}.txt`), `${rows.map(({ r }) => r.label).join('\n')}\n`);
  console.log(sheet.name, `${W}x${H}`, `${rows.length} rows`);
}

/**
 * The numbers the plan's F0 asks for (spec 5.5), at D1, D2 and D4 on both base figures, view 0:
 * - the usable width of a side badge: at `chestY - 0.06 k`, the run of torso texels on one side of the centre whose
 *   normal turns less than 50° from the eye (sideways; stampPrint's `turn` 0.6), less a texel of margin; and the whole torso's across there;
 * - the wrist's width a texel above the wrist (x × z, texels), and the chest's central run (what a fob hangs on);
 * - the eye's width and the face's half-width (`FaceStamp.eye`, `.size`);
 * - the shod foot's length (texels, view 2: the widest row at or under the ankle).
 */
function measureAll() {
  const lines: string[] = ['id  D | badge side run (usable) | torso across | chest central run | wrist x×z | eye | face half | foot'];
  for (const b of BASE) for (const d of [1, 2, 4]) {
    const cast = member(b.def, d), m = measure(b.def.sliders), s = skeleton(m.genes), body = bodyOf(m, s, cast.cell[1] / cast.metres), ppm = cast.cell[1] / cast.metres;
    const f = new Figure(cast), cp = Math.cos(SPRITE_PITCH), sp = Math.sin(SPRITE_PITCH), [w] = cast.cell;
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: 0, moving: false, view: view(SPRITE_PITCH), clock: 0 });
    const g = f.g, k = m.k, rowOf = (y: number, z: number) => Math.round(cast.cell[1] - cast.feet - (y * cp - z * sp) * ppm);
    const lateral = (i: number) => { const nx = Math.abs(g.normal[i * 3]), nz = g.normal[i * 3 + 2]; return nz <= 0 ? 90 : Math.atan(nx / nz) * 180 / Math.PI; };
    /** The torso run from the centre column `dir` ways, within 50° of the eye. */
    const run = (row: number, dir: 1 | -1) => { let n = 0; for (let x = Math.round(w / 2) + dir; x >= 0 && x < w; x += dir) { const i = row * g.w + x; if (g.group[i] !== GROUP.torso || lateral(i) > 50) break; n++; } return n; };
    const across = (row: number) => { let n = 0; for (let x = 0; x < w; x++) if (g.group[row * g.w + x] === GROUP.torso) n++; return n; };
    const by = s.chestY - 0.06 * k, bz = body.at('torso', 'L', by).rz + (body.at('torso', 'L', by).dz ?? 0), brow = rowOf(by, bz), crow = rowOf(s.chestY, bz);
    const wristY = s.rest[J['upperArm.L']][1] - s.genes.arms + 1 / ppm, wr = body.at('arm', 'L', wristY);
    // The foot: view 2, the rows at and under the ankle, the widest run of opaque texels.
    const side = new Figure(cast);
    for (let i = 0; i < 3; i++) side.update(1 / 60, { facing: 2 * Math.PI / 4, moving: false, view: view(SPRITE_PITCH), clock: 0 });
    let foot = 0;
    for (let y = rowOf(s.genes.ankle, 0); y < cast.cell[1]; y++) { let n = 0; for (let x = 0; x < w; x++) if (side.painted[(y * w + x) * 4 + 3]) n++; foot = Math.max(foot, n); }
    const stamp = (f as unknown as { faceStamp: { eye: number; size: number } }).faceStamp;
    const usable = Math.max(0, Math.max(run(brow, 1), run(brow, -1)) - 1);
    lines.push(`${b.def.id} D${d} | ${usable} | ${across(brow)} | ${run(crow, 1) + run(crow, -1) + 1} | ${(2 * wr.rx * ppm).toFixed(1)}×${(2 * wr.rz * ppm).toFixed(1)} | ${stamp.eye} | ${stamp.size.toFixed(1)} | ${foot}`);
  }
  console.log(lines.join('\n'));
}

const args = process.argv.slice(2), out = resolve(args[0] ?? resolve(import.meta.dirname, '../out/c9'));
if (args.includes('--measure')) measureAll();
else {
  mkdirSync(out, { recursive: true });
  const names = args.slice(1).filter(a => !a.startsWith('--')), picked = names.length ? names : SHEETS.map(s => s.name);
  for (const name of picked) { const sheet = SHEETS.find(s => s.name === name); if (!sheet) throw new Error(`c9-sheet: no sheet ${name}; the sheets are ${SHEETS.map(s => s.name).join(', ')}`); draw(sheet, out); }
}
