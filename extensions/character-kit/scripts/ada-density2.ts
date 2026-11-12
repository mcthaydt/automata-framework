// Ada at density 2, standing alone and plain (no room light, no passes), beside the base woman at the same size: the head and
// shoulders at x10 and the whole figure at x4, front and three-quarter. Painted in Node by the kit's helpers; the faces are
// judged against FigureBuilder's density-2 reference (the base pair, eye-swap.png). A study: it changes nothing.
//
//   pnpm --filter @automata/character-kit ada-d2 <out-dir> <name> [candidate ...]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ADA, defAtDensity } from '../../../games/the-last-light/src/features/figures/cast.ts'
import type { CharacterDef } from '../src/entries/index.ts'
import {
  blit,
  crop,
  encodePng,
  fill,
  newRaster,
  type PaintedCell,
  paintedCell,
  type Raster,
  rowWidths,
  text,
} from '../src/entries/testing.ts'
import { BASE } from '../src/shared/figures/door.ts'
import { CANDIDATES } from './ada-density2-candidates.ts'

const BACK = [196, 196, 196, 255] as const
const INK = [20, 20, 20, 255] as const
const asRaster = (c: PaintedCell): Raster => ({ w: c.size[0], h: c.size[1], data: c.painted })
const baseWoman = (BASE[1] as { def: CharacterDef }).def

/** The opaque bounding box of a cell. */
function bounds(c: PaintedCell): { top: number; left: number; right: number; bottom: number } {
  const [w, h] = c.size
  let top = h
  let bottom = 0
  let left = w
  let right = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if ((c.painted[(y * w + x) * 4 + 3] ?? 0) > 0) {
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
        left = Math.min(left, x)
        right = Math.max(right, x)
      }
  return { top, bottom, left, right }
}

const head = (c: PaintedCell, w: number, h: number, scale: number): Raster => {
  const b = bounds(c)
  const out = newRaster(w * scale, h * scale)
  fill(out, 0, 0, out.w, out.h, BACK)
  const mid = Math.round((b.left + b.right) / 2)
  blit(out, crop(asRaster(c), mid - (w >> 1), Math.max(0, b.top - 2), w, h), 0, 0, scale)
  return out
}
const body = (c: PaintedCell, scale: number): Raster => {
  const b = bounds(c)
  const w = 64
  const h = b.bottom - b.top + 5
  const out = newRaster(w * scale, h * scale)
  fill(out, 0, 0, out.w, out.h, BACK)
  const mid = Math.round((b.left + b.right) / 2)
  blit(out, crop(asRaster(c), mid - (w >> 1), b.top - 2, w, h), 0, 0, scale)
  return out
}
const side = (rs: Raster[], gap = 14, pad = 10): Raster => {
  const w = rs.reduce((s, r) => s + r.w + gap, pad * 2 - gap)
  const h = Math.max(...rs.map((r) => r.h)) + pad * 2
  const out = newRaster(w, h)
  fill(out, 0, 0, w, h, BACK)
  let x = pad
  for (const r of rs) {
    blit(out, r, x, pad, 1)
    x += r.w + gap
  }
  return out
}
const labelled = (r: Raster, caption: string): Raster => {
  const out = newRaster(r.w, r.h + 22)
  fill(out, 0, 0, out.w, out.h, BACK)
  text(out, caption, 8, 6, 2, INK)
  blit(out, r, 0, 22, 1)
  return out
}

const [out, name, ...which] = process.argv.slice(2)
if (out === undefined || name === undefined) throw new Error('usage: ada-d2 <out-dir> <name> [candidate ...]')
mkdirSync(out, { recursive: true })
const subjects: { label: string; def: CharacterDef }[] = [
  { label: 'BASE MAN', def: (BASE[0] as { def: CharacterDef }).def },
  { label: 'BASE WOMAN', def: baseWoman },
  ...(which.length === 0 ? Object.keys(CANDIDATES) : which).map((k) => ({
    label: k.toUpperCase(),
    def: defAtDensity(CANDIDATES[k] ?? ADA)(2),
  })),
]
const cells = subjects.map((s) => ({
  ...s,
  front: paintedCell(s.def, 0, 2),
  three: paintedCell(s.def, 1, 2),
}))
const rowsOf = (cell: PaintedCell) => rowWidths(cell).filter((x) => x > 0).length
for (const s of cells) console.log(s.label, 'rows', rowsOf(s.front), 'cell', s.front.size.join('x'))
const heads = cells.map((s) => head(s.front, 40, 40, 10))
writeFileSync(
  join(out, `${name}-head-x10.png`),
  encodePng(
    labelled(side(heads), `HEAD AND SHOULDERS, DENSITY 2, X10: ${subjects.map((s) => s.label).join(' | ')}`),
  ),
)
const bodies = cells.flatMap((s) => [body(s.front, 4), body(s.three, 4)])
writeFileSync(
  join(out, `${name}-body-x4.png`),
  encodePng(
    labelled(side(bodies), 'FULL BODY X4, FRONT AND 3/4: ' + subjects.map((s) => s.label).join(' | ')),
  ),
)
