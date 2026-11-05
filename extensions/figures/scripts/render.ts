/**
 * Renders the base pair (base/base.ts) with the builder, in Node. Free: no API.
 *
 *   [DENSITY=2] npm run render -- [OUT_DIR] [PITCH_DEG]
 *
 * Writes per member: <id>-turn.png (the 8 views in the relaxed stand), <id>-walk.png (the walk's 8 poses, one per step of
 * its cycle, three-quarter front) and <id>-hero.png (the three-quarter lookbook stand, the member's own pose), each at 1×
 * and ×8 nearest.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { BASE, hero, member, standing, walking, type Frame } from '../src/index';

const out = resolve(process.argv[2] ?? resolve(import.meta.dirname, '../out'));
const pitch = Number(process.argv[3] ?? 18) * Math.PI / 180;
const ZOOM = 8;
mkdirSync(out, { recursive: true });

function strip(frames: Frame[], w: number, h: number, file: string) {
  const c = createCanvas(frames.length * w, h), ctx = c.getContext('2d');
  frames.forEach((px, i) => { const img = ctx.createImageData(w, h); img.data.set(px); ctx.putImageData(img, i * w, 0); });
  writeFileSync(join(out, `${file}.png`), c.toBuffer('image/png'));
  const big = createCanvas(c.width * ZOOM, c.height * ZOOM), bc = big.getContext('2d');
  bc.imageSmoothingEnabled = false; bc.drawImage(c, 0, 0, big.width, big.height);
  writeFileSync(join(out, `${file}-x${ZOOM}.png`), big.toBuffer('image/png'));
}

for (const c of BASE) {
  const cast = member(c.def, Number(process.env.DENSITY ?? 1)), [w, h] = cast.cell;
  strip([0, 1, 2, 3, 4, 5, 6, 7].map(d => standing(cast, d, pitch)), w, h, `${c.def.id}-turn`);
  strip([hero(cast, c.pose, Math.PI / 4, pitch)], w, h, `${c.def.id}-hero`);
  strip(walking(cast, pitch), w, h, `${c.def.id}-walk`);
  console.log(c.def.id, `${w}x${h}`, `walk ${cast.gait.walkPoses}`);
}
