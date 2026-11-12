// The look sheets of the painted cast: a figure's eight standing views and its walk at density 2 (so the drawing can be read), and
// at density 1, the size it is played at, beside the old game's own figure, all on a mid-dark floor and drawn up with whole texels.
// Made with the kit's testing helpers: the painter in Node, no browser. The old game's figures are its committed review sheets
// (`docs/art/{ada,nurse}-figure/*-review.png` at 92e6704), cropped by their grid; nothing is repainted by hand.
//
//   pnpm --filter @automata/character-kit sheet <out-dir> <round> [ada|nurse ...] [--old <old-game-checkout>]
//
// Writes `<out-dir>/<round>-<id>-detail.png` (density 2, each texel 2 pixels) and `<round>-<id>-play.png` (density 1, each texel 4).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ADA, NIGHT_NURSE } from '../../../games/the-last-light/src/features/figures/cast.ts'
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
  type Raster,
  rowWidths,
  type Silhouette,
  silhouette,
  texelsOfSwatch,
  text,
  textHeight,
  textWidth,
} from '../src/entries/testing.ts'

/** The floor the figures stand on: a mid-dark of the hall's, the same under ours and under the old game's. */
const FLOOR = [52, 56, 58, 255] as const
const INK = [225, 225, 215, 255] as const
const DIM = [150, 155, 150, 255] as const
/** The sheet's own colour in the old game's review sheets: a texel of it is no figure. */
const OLD_BG = [31, 42, 38] as const

const NAMES = ['FRONT', '3/4 LEFT', 'LEFT', 'BACK LEFT', 'BACK', 'BACK RIGHT', 'RIGHT', '3/4 RIGHT']

interface Subject {
  readonly id: 'ada' | 'nurse'
  readonly def: CharacterDef
  /** The old game's review sheet and where the procedural figure's flat row, and the approved atlas's, are in it (rows of 74 or 98 texels). */
  readonly old: {
    readonly file: string
    readonly cell: readonly [number, number]
    readonly procedural: number
    readonly atlas?: number
  }
  /** The swatches whose texels the numbers file counts: the garments and the hair. */
  readonly swatches: readonly string[]
}
const SUBJECTS: Subject[] = [
  {
    id: 'ada',
    def: ADA,
    old: { file: 'docs/art/ada-figure/ada-review.png', cell: [48, 72], procedural: 6, atlas: 0 },
    swatches: ['maroon', 'cream', 'denim', 'bootBrown', 'auburn', 'fair'],
  },
  {
    id: 'nurse',
    def: NIGHT_NURSE,
    old: { file: 'docs/art/nurse-figure/nurse-review.png', cell: [64, 96], procedural: 2, atlas: 0 },
    swatches: ['wardWhite', 'stain', 'stockingDark', 'heavyShoe', 'capWhite', 'inkBlack', 'pale'],
  },
]

const asRaster = (c: PaintedCell): Raster => ({ w: c.size[0], h: c.size[1], data: c.painted })

/** A panel: the cell on the floor, `scale` pixels a texel, its caption above. Cells of one row share a height, so feet line up. */
function panel(cell: Raster, scale: number, caption: string, width = cell.w): Raster {
  const pad = 2 * scale
  const out = newRaster(width * scale + 2 * pad, cell.h * scale + textHeight(2) + 3 * pad)
  fill(out, 0, 0, out.w, out.h, [30, 33, 35, 255])
  fill(out, pad, textHeight(2) + 2 * pad, width * scale, cell.h * scale, FLOOR)
  blit(out, cell, pad + ((width - cell.w) / 2) * scale, textHeight(2) + 2 * pad, scale)
  text(out, caption, pad, pad, 2, INK)
  return out
}

/** Panels in a row, with a heading on the left. */
function row(heading: string, panels: Raster[]): Raster {
  const head = textHeight(3) + 8
  const out = newRaster(
    Math.max(...[panels.reduce((w, p) => w + p.w, 0), textWidth(heading, 3) + 16]),
    head + Math.max(...panels.map((p) => p.h)),
  )
  fill(out, 0, 0, out.w, out.h, [30, 33, 35, 255])
  text(out, heading, 8, 4, 3, INK)
  let x = 0
  for (const p of panels) {
    blit(out, p, x, head, 1)
    x += p.w
  }
  return out
}

function stack(rows: Raster[]): Raster {
  const out = newRaster(
    Math.max(...rows.map((r) => r.w)),
    rows.reduce((h, r) => h + r.h, 0),
  )
  fill(out, 0, 0, out.w, out.h, [30, 33, 35, 255])
  let y = 0
  for (const r of rows) {
    blit(out, r, 0, y, 1)
    y += r.h
  }
  return out
}

/** The old game's cell `col` of `row` from its review sheet (a 2-texel gap between cells), its sheet colour made transparent. */
function oldCell(sheet: Raster, cell: readonly [number, number], row: number, col: number): Raster {
  const [w, h] = cell
  const c = crop(sheet, 2 + col * (w + 2), 2 + row * (h + 2), w, h)
  for (let i = 0; i < c.data.length; i += 4)
    if (c.data[i] === OLD_BG[0] && c.data[i + 1] === OLD_BG[1] && c.data[i + 2] === OLD_BG[2])
      c.data[i + 3] = 0
  return c
}

/** One figure's numbers, from its front view: the silhouette, and each swatch's texels, its rows as shares of the height and its widest row. */
function numbers(name: string, def: CharacterDef, cell: PaintedCell, swatches: readonly string[]): string[] {
  const s = silhouette(cell)
  const lines = [
    `${name}: ${measure(s)}  (hip/height ${(s.hip / s.height).toFixed(3)}, shoulder/height ${(s.shoulder / s.height).toFixed(3)})`,
  ]
  for (const swatch of swatches) {
    const w = rowWidths(cell, { def, swatch })
    const first = w.findIndex((x) => x > 0)
    if (first < 0) continue
    const last = w.length - 1 - [...w].reverse().findIndex((x) => x > 0)
    const share = (r: number) => ((r - s.top) / s.height).toFixed(2)
    lines.push(
      `  ${swatch.padEnd(13)} texels ${String(texelsOfSwatch(def, cell, swatch)).padStart(4)}  rows ${share(first)}-${share(last)}  widest ${Math.max(...w)}`,
    )
  }
  return lines
}

/** One line of numbers for a figure: its height and its widths in texels. */
const measure = (s: Silhouette): string =>
  `H ${s.height}  SHOULDER ${s.shoulder}  WAIST ${s.waist}  HIP ${s.hip}`

export function sheets(subject: Subject, oldRoot: string | undefined, out: string, round: string): void {
  const detailStand = paintedStand(subject.def, 2)
  const detailWalk = paintedWalk(subject.def, 2)
  const detail = stack([
    row(
      `${subject.def.name} - DENSITY 2, X2 - STANDING`,
      detailStand.map((c, i) => panel(asRaster(c), 2, NAMES[i] ?? '', 128)),
    ),
    row(
      `WALK, 3/4 FRONT, ${detailWalk.length} POSES`,
      detailWalk.map((c, i) => panel(asRaster(c), 2, `WALK ${i + 1}`, 128)),
    ),
  ])
  writeFileSync(join(out, `${round}-${subject.id}-detail.png`), encodePng(detail))

  const playStand = paintedStand(subject.def, 1)
  const playWalk = paintedWalk(subject.def, 1)
  const front = silhouette(playStand[0]!)
  const rows = [
    row(
      `OURS - DENSITY 1, X4 - ${measure(front)}`,
      playStand.map((c, i) => panel(asRaster(c), 4, NAMES[i] ?? '', 64)),
    ),
  ]
  if (oldRoot !== undefined) {
    const sheet = decodePng(readFileSync(join(oldRoot, subject.old.file)))
    const oldRow = (r: number, label: string) =>
      row(
        label,
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
          panel(oldCell(sheet, subject.old.cell, r, i), 4, NAMES[i] ?? '', 64),
        ),
      )
    rows.push(oldRow(subject.old.procedural, 'OLD GAME PROCEDURAL (ITS REVIEW SHEET, 92E6704), SAME SCALE'))
    if (subject.old.atlas !== undefined)
      rows.push(oldRow(subject.old.atlas, 'OLD GAME APPROVED HAND-PAINTED ATLAS, SAME SCALE'))
  }
  rows.push(
    row(
      'OURS - WALK',
      playWalk.map((c, i) => panel(asRaster(c), 4, `WALK ${i + 1}`, 64)),
    ),
  )
  writeFileSync(join(out, `${round}-${subject.id}-play.png`), encodePng(stack(rows)))

  // The numbers the README quotes, measured from the pictures and never typed.
  const lines = numbers('ours, density 1, front', subject.def, playStand[0]!, subject.swatches)
  if (oldRoot !== undefined) {
    const sheet = decodePng(readFileSync(join(oldRoot, subject.old.file)))
    const asCell = (r: number): PaintedCell => {
      const c = oldCell(sheet, subject.old.cell, r, 0)
      return { painted: c.data, size: [c.w, c.h] }
    }
    lines.push(
      ...numbers('old procedural, front', subject.def, asCell(subject.old.procedural), subject.swatches),
    )
    if (subject.old.atlas !== undefined)
      lines.push(
        ...numbers('old hand-painted atlas, front', subject.def, asCell(subject.old.atlas), subject.swatches),
      )
  }
  writeFileSync(join(out, `${round}-${subject.id}-numbers.txt`), `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))
}

if (process.argv[1]?.endsWith('figure-sheet.ts')) {
  const args = process.argv.slice(2)
  const oldAt = args.indexOf('--old')
  const oldRoot = oldAt < 0 ? undefined : args[oldAt + 1]
  const rest = args.filter((_, i) => oldAt < 0 || (i !== oldAt && i !== oldAt + 1))
  const [out, round, ...ids] = rest
  if (out === undefined || round === undefined)
    throw new Error('usage: figure-sheet <out-dir> <round> [ada|nurse ...] [--old <dir>]')
  mkdirSync(out, { recursive: true })
  for (const s of SUBJECTS) if (ids.length === 0 || ids.includes(s.id)) sheets(s, oldRoot, out, round)
}
