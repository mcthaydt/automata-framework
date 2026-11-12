// A round of Ada's rebuild: one sheet with the generated turnaround on top, her eight standing views and her walk at density 2, a face
// at x8 beside the references' face, her at the size she is played (density 1, x4) beside density 2 (x2) so the cost of each size is plain,
// and the proportions table against the look spec. Painted in Node by the kit's helpers; the numbers come from the pictures.
//
//   pnpm --filter @automata/character-kit rebuild-ada <out-dir> <name> <look> --old <old-game-checkout>
//
// `<look>` is a list in `ada-rebuilt.ts` (`LOOKS`); its variant labelled ADOPTED is drawn in full, and every variant in one strip.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CharacterDef } from '../src/entries/index.ts'
import {
  blit,
  crop,
  decodePng,
  encodePng,
  fill,
  newRaster,
  type PaintedCell,
  paintedStand,
  paintedWalk,
  proportions,
  type Raster,
  rowWidths,
  text,
  textHeight,
} from '../src/entries/testing.ts'
import { LOOKS } from './ada-rebuilt.ts'
import { captioned, downscale, LANDMARKS, measureTurnaround } from './figure-reference.ts'
import { asRaster, at, NAMES, panel, row, stack } from './figure-sheet.ts'

const INK = [225, 225, 215, 255] as const
const BACK = [30, 33, 35, 255] as const
const TURNAROUND = 'docs/art/ada-3d/turnaround.png'
/** The turnaround's three figures: where each stands in the picture (x range) and the rows that hold a whole one. */
const FIGURES = { front: [60, 540], side: [560, 1000], back: [1000, 1480] } as const
const TOP = 20
const BOTTOM = 990

/** A reference figure scaled so a figure of `rows` rows is as tall as a density-2 cell drawn at `scale`: the texel's size on the sheet. */
function referenceFigure(t: Raster, which: keyof typeof FIGURES, rows: number, scale: number): Raster {
  const [x0, x1] = FIGURES[which]
  const f = (rows * scale) / (947 + 2 * 7)
  return downscale(crop(t, x0, TOP, x1 - x0, BOTTOM - TOP), f)
}

/** The head's crop of a painted cell at `scale`: `w` by `h` texels from just above the first opaque row, about the head's middle column. */
export function faceCrop(cell: PaintedCell, w: number, h: number, scale: number): Raster {
  const r = asRaster(cell)
  const rows = rowWidths(cell)
  const top = rows.findIndex((x) => x > 0)
  const mid = Math.round(cell.size[0] / 2)
  const small = crop(r, mid - Math.floor(w / 2), Math.max(0, top - 1), w, h)
  const out = newRaster(w * scale, h * scale)
  fill(out, 0, 0, out.w, out.h, [52, 56, 58, 255])
  blit(out, small, 0, 0, scale)
  return out
}

/** A reference head at the same scale as `headRows` rows of ours drawn at `scale`. */
function referenceFace(t: Raster, x: number, headRows: number, scale: number, w: number, h: number): Raster {
  const head = LANDMARKS.chin - 33 + 1
  const f = (headRows * scale) / head
  const src = crop(
    t,
    x - Math.round((w * scale) / f / 2),
    33 - Math.round(scale / f),
    Math.round((w * scale) / f),
    Math.round((h * scale) / f),
  )
  return downscale(src, f)
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

/** The look spec's numbers and the figure's, side by side. */
export function table(def: CharacterDef, t: Raster): string[] {
  const m = measureTurnaround(t)
  const H = m.floor - m.top + 1
  const head = LANDMARKS.chin - m.top + 1
  const [d2, d1] = [proportions(def, 2), proportions(def, 1)]
  const bootShare = (d: 1 | 2): number => {
    const cell = paintedStand(def, d)[0] as PaintedCell
    const w = rowWidths(cell, { def, swatch: 'bootBrown' })
    const h = proportions(def, d).height
    const floor = w.length - 1 - [...rowWidths(cell)].reverse().findIndex((x) => x > 0)
    // The boots are the leather's rows in the lowest quarter of her (the hair's auburn is another swatch).
    const a = w.findIndex((x, y) => x > 0 && y > floor - h * 0.25)
    return a < 0 ? 0 : (floor - a + 1) / h
  }
  const rows: [string, string, string, string][] = [
    ['', 'SPEC', 'D2', 'D1'],
    ['height (rows)', String(H), String(d2.height), String(d1.height)],
    [
      'head + hair, share of height',
      pct(head / H),
      pct(d2.headRowsWithHair / d2.height),
      pct(d1.headRowsWithHair / d1.height),
    ],
    ['heads tall, hair on', (H / head).toFixed(2), d2.headsWithHair.toFixed(2), d1.headsWithHair.toFixed(2)],
    [
      'legs, crotch to floor',
      pct((m.floor - m.crotch) / H),
      pct(d2.legRows / d2.height),
      pct(d1.legRows / d1.height),
    ],
    [
      'hip joint (rig)',
      pct((m.floor - m.crotch) / H),
      pct(d2.rig?.hipJoint ?? 0),
      pct(d1.rig?.hipJoint ?? 0),
    ],
    ['knee (rig)', pct((m.floor - LANDMARKS.knee) / H), pct(d2.rig?.knee ?? 0), pct(d1.rig?.knee ?? 0)],
    [
      'trunk, shoulder to crotch',
      pct((m.crotch - LANDMARKS.shoulder) / H),
      pct(d2.trunkRows / d2.height),
      pct(d1.trunkRows / d1.height),
    ],
    [
      'shoulder width (sleeves)',
      pct((m.widths['shirt across the sleeve caps'] ?? 0) / H),
      pct(d2.shoulder / d2.height),
      pct(d1.shoulder / d1.height),
    ],
    [
      'hip width (spec: arms apart)',
      pct((m.widths['jeans across the hips (10 rows above the crotch)'] ?? 0) / H),
      pct(d2.hip / d2.height),
      pct(d1.hip / d1.height),
    ],
    ['boots, share of height', pct((m.floor - LANDMARKS.hem) / H), pct(bootShare(2)), pct(bootShare(1))],
  ]
  const w = Math.max(...rows.map((r) => r[0].length)) + 2
  return rows.map(([a, b, c, d]) => `${a.padEnd(w)}${b.padEnd(10)}${c.padEnd(10)}${d}`)
}

function main(): void {
  const args = process.argv.slice(2)
  const oldAt = args.indexOf('--old')
  const [out, name, look] = args
  const root = oldAt < 0 ? undefined : args[oldAt + 1]
  if (out === undefined || name === undefined || look === undefined || root === undefined)
    throw new Error(
      `usage: figure-rebuild <out-dir> <name> <look: ${Object.keys(LOOKS).join(' | ')}> --old <old-game>`,
    )
  const variants = LOOKS[look]
  if (variants === undefined) throw new Error(`no look ${look}`)
  mkdirSync(out, { recursive: true })
  const adopted =
    variants.find((v) => v.label.includes('ADOPTED')) ?? (variants[0] as (typeof variants)[number])
  const def = adopted.def
  const t = decodePng(readFileSync(join(root, TURNAROUND)))

  const stand2 = paintedStand(def, 2)
  const walk2 = paintedWalk(def, 2)
  const front2 = proportions(def, 2)
  const refRows = front2.height
  const refs = row(
    'THE GENERATED TURNAROUND (THE TARGET), SCALED TO HER SIZE AT DENSITY 2, X2',
    (['front', 'side', 'back'] as const).map((k) =>
      captioned(referenceFigure(t, k, refRows, 2), [k.toUpperCase()]),
    ),
  )
  const standing = row(
    `${adopted.label} - DENSITY 2, X2 - STANDING`,
    stand2.map((c, i) => panel(asRaster(c), 2, NAMES[i] ?? '', 128)),
  )
  const walking = row(
    `WALK, ${walk2.length} POSES`,
    walk2.map((c, i) => panel(asRaster(c), 2, `WALK ${i + 1}`, 128)),
  )
  const headRows = front2.headRowsWithHair
  const faces = row('THE FACE, X8: THE REFERENCE, OURS FRONT, 3/4, SIDE, THE REFERENCE SIDE', [
    captioned(referenceFace(t, 300, headRows, 8, 40, 34), ['REFERENCE FRONT']),
    captioned(faceCrop(at(stand2, 0), 40, 34, 8), ['OURS FRONT']),
    captioned(faceCrop(at(stand2, 1), 40, 34, 8), ['OURS 3/4']),
    captioned(faceCrop(at(stand2, 2), 40, 34, 8), ['OURS SIDE']),
    captioned(referenceFace(t, 740, headRows, 8, 40, 34), ['REFERENCE SIDE']),
  ])
  const stand1 = paintedStand(def, 1)
  const cost = row(
    'WHAT EACH SIZE COSTS: DENSITY 1 AT X4 AND DENSITY 2 AT X2 ARE THE SAME SIZE ON THE SCREEN',
    [0, 1, 2, 4].flatMap((d) => [
      panel(asRaster(at(stand1, d)), 4, `D1 ${NAMES[d]}`, 64),
      panel(asRaster(at(stand2, d)), 2, `D2 ${NAMES[d]}`, 128),
    ]),
  )
  const strips = row(
    'EVERY VARIANT OF THE ROUND, FRONT AND 3/4, DENSITY 2, X3',
    variants.flatMap((v) => {
      const s = paintedStand(v.def, 2)
      return [0, 1].map((d) => panel(asRaster(at(s, d)), 3, `${v.label} ${NAMES[d]}`, 128))
    }),
  )
  const lines = table(def, t)
  const tableRaster = newRaster(1700, (lines.length + 1) * (textHeight(2) + 6) + 12)
  fill(tableRaster, 0, 0, tableRaster.w, tableRaster.h, BACK)
  for (const [i, l] of lines.entries()) text(tableRaster, l, 8, 8 + i * (textHeight(2) + 6), 2, INK)
  writeFileSync(
    join(out, `${name}-sheet.png`),
    encodePng(stack([refs, standing, walking, faces, cost, strips, tableRaster])),
  )
  writeFileSync(
    join(out, `${name}-numbers.txt`),
    `${adopted.label}\n${lines.join('\n')}\n${variants.map((v) => `${v.label}: ${v.note}`).join('\n')}\n`,
  )
  console.log(lines.join('\n'))
}

if (process.argv[1]?.endsWith('figure-rebuild.ts')) main()
