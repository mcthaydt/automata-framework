// The reference board for Ada: every generated image of her in the old game (the character pipeline's image model drew them), on one
// sheet, with the old shipped sprites under them marked as what was shipped and not as the target; and the numbers of the turnaround,
// which is the target for her proportions. The references are only looked at and measured: nothing here is copied into the game.
//
//   pnpm --filter @automata/character-kit reference <out-dir> --old <old-game-checkout>
//
// Writes `<out-dir>/ref-board.png`, `ref-turnaround-marked.png` (the landmarks drawn on the picture so they can be checked by eye)
// and `ref-spec-numbers.txt`. The turnaround's top, the floor and the crotch are found in the picture; the other landmarks (chin, eyes,
// shoulder line, elbow, wrist, fingertips, knee, jeans hem) are read off it by eye, written down once below and drawn on the marked copy.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  blit,
  crop,
  decodePng,
  encodePng,
  fill,
  newRaster,
  type Raster,
  text,
  textHeight,
} from '../src/entries/testing.ts'
import { oldCell } from './figure-sheet.ts'

const INK = [225, 225, 215, 255] as const
const BACK = [30, 33, 35, 255] as const
const MARK = [255, 0, 255, 255] as const

/** An area-averaged copy of `r` at `f` times its size (f below 1), alpha taken as opaque: the references are photographs of paint, not texels. */
export function downscale(r: Raster, f: number): Raster {
  const w = Math.max(1, Math.round(r.w * f))
  const h = Math.max(1, Math.round(r.h * f))
  const out = newRaster(w, h)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x0 = Math.floor(i / f)
      const x1 = Math.max(x0 + 1, Math.min(r.w, Math.ceil((i + 1) / f)))
      const y0 = Math.floor(j / f)
      const y1 = Math.max(y0 + 1, Math.min(r.h, Math.ceil((j + 1) / f)))
      let rr = 0
      let gg = 0
      let bb = 0
      let n = 0
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const at = (y * r.w + x) * 4
          rr += r.data[at] ?? 0
          gg += r.data[at + 1] ?? 0
          bb += r.data[at + 2] ?? 0
          n++
        }
      out.data.set([Math.round(rr / n), Math.round(gg / n), Math.round(bb / n), 255], (j * w + i) * 4)
    }
  return out
}

/** `r` enlarged by a whole number, each source pixel a square (for the pixel-art references, so a pixel stays a pixel). */
export function enlarge(r: Raster, k: number): Raster {
  const out = newRaster(r.w * k, r.h * k)
  blit(out, r, 0, 0, k)
  return out
}

/** A captioned panel: the picture under a line or two of caption. */
export function captioned(picture: Raster, lines: readonly string[]): Raster {
  const lineH = textHeight(2) + 4
  const out = newRaster(picture.w + 8, picture.h + lines.length * lineH + 12)
  fill(out, 0, 0, out.w, out.h, BACK)
  blit(out, picture, 4, 4, 1)
  for (const [i, l] of lines.entries()) text(out, l, 6, picture.h + 8 + i * lineH, 2, INK)
  return out
}

/** Panels left to right, tops aligned, with a heading. */
export function strip(heading: string, panels: readonly Raster[], gap = 6): Raster {
  const head = textHeight(3) + 14
  const w = panels.reduce((a, p) => a + p.w + gap, gap)
  const out = newRaster(w, head + Math.max(...panels.map((p) => p.h)) + gap)
  fill(out, 0, 0, out.w, out.h, BACK)
  text(out, heading, 8, 6, 3, INK)
  let x = gap
  for (const p of panels) {
    blit(out, p, x, head, 1)
    x += p.w + gap
  }
  return out
}

/** Panels in a grid of `cols`. */
export function grid(heading: string, panels: readonly Raster[], cols: number): Raster {
  const rows: Raster[] = []
  for (let i = 0; i < panels.length; i += cols)
    rows.push(strip(i === 0 ? heading : '', panels.slice(i, i + cols)))
  const out = newRaster(
    Math.max(...rows.map((r) => r.w)),
    rows.reduce((h, r) => h + r.h, 0),
  )
  fill(out, 0, 0, out.w, out.h, BACK)
  let y = 0
  for (const r of rows) {
    blit(out, r, 0, y, 1)
    y += r.h
  }
  return out
}

/** Landmarks of the turnaround's front figure, in rows of the 1536 by 1024 picture. `eyes` .. `knee`, `hem` are read off it by eye. */
export const LANDMARKS = {
  eyes: 130,
  chin: 172,
  shoulder: 222,
  elbow: 395,
  vestHem: 415,
  wrist: 520,
  fingertips: 565,
  knee: 705,
  hem: 832,
} as const

export interface Turnaround {
  readonly top: number
  readonly floor: number
  readonly crotch: number
  /** Widths (pixels) of the front figure at named rows. */
  readonly widths: Readonly<Record<string, number>>
  readonly figureCentre: number
}

const nonWhite = (r: Raster, x: number, y: number): boolean => {
  const at = (y * r.w + x) * 4
  return (
    Math.abs((r.data[at] ?? 255) - 255) +
      Math.abs((r.data[at + 1] ?? 255) - 255) +
      Math.abs((r.data[at + 2] ?? 255) - 255) >
    60
  )
}

/** What the picture itself gives: the top, the floor, the crotch (the first row up from the boots where the centre column is solid) and
 *  the widths at the landmarks, the widest run of non-white texels that holds the centre line (arms held out are separate runs). */
export function measureTurnaround(t: Raster, x0 = 60, x1 = 540): Turnaround {
  let top = -1
  let floor = -1
  for (let y = 0; y < t.h; y++) {
    let any = false
    for (let x = x0; x < x1 && !any; x++) any = nonWhite(t, x, y)
    if (any && top < 0) top = y
    if (any) floor = y
  }
  const rowRuns = (y: number): [number, number][] => {
    const runs: [number, number][] = []
    let s = -1
    for (let x = x0; x <= x1; x++) {
      const on = x < x1 && nonWhite(t, x, y)
      if (on && s < 0) s = x
      if (!on && s >= 0) {
        runs.push([s, x - 1])
        s = -1
      }
    }
    return runs
  }
  const all = rowRuns(Math.floor((top + floor) / 2))
  const centre = Math.round(
    all.length === 0
      ? (x0 + x1) / 2
      : ((all[0] as [number, number])[0] + (all[all.length - 1] as [number, number])[1]) / 2,
  )
  let crotch = floor
  while (crotch > top && !nonWhite(t, centre, crotch)) crotch--
  const widthAt = (y: number): number => {
    const run = rowRuns(y).find(([a, b]) => a <= centre && centre <= b)
    return run === undefined ? 0 : run[1] - run[0] + 1
  }
  const widths: Record<string, number> = {
    'hair (widest, eye row)': widthAt(LANDMARKS.eyes + 20),
    'shirt across the sleeve caps': widthAt(LANDMARKS.shoulder + 38),
    'waistcoat at the hem': widthAt(LANDMARKS.vestHem - 8),
    'jeans across the hips (10 rows above the crotch)': widthAt(crotch - 10),
  }
  return { top, floor, crotch, widths, figureCentre: centre }
}

/** The numbers the spec quotes: shares of the figure's height, in heads, from the landmarks. */
export function specNumbers(t: Turnaround): string[] {
  const H = t.floor - t.top + 1
  const head = LANDMARKS.chin - t.top + 1
  const share = (rows: number) => `${rows} rows, ${((rows / H) * 100).toFixed(1)} %`
  const up = (y: number) => ((t.floor - y + 1) / H) * 100
  const lines = [
    `the turnaround's front figure: ${H} rows tall (top ${t.top}, floor ${t.floor})`,
    `head with its hair, top to chin: ${share(head)}; ${(H / head).toFixed(2)} heads tall`,
    `eye line from the top of the hair: ${share(LANDMARKS.eyes - t.top)} (${(((LANDMARKS.eyes - t.top) / head) * 100).toFixed(0)} % down the head), eye line to chin ${LANDMARKS.chin - LANDMARKS.eyes} rows`,
    `chin to the shoulder line: ${share(LANDMARKS.shoulder - LANDMARKS.chin)}`,
    `shoulder line to the waistcoat hem (trunk): ${share(LANDMARKS.vestHem - LANDMARKS.shoulder)}; to the crotch: ${share(t.crotch - LANDMARKS.shoulder)}`,
    `crotch to the floor (legs): ${share(t.floor - t.crotch)} (hip joint at ${up(t.crotch).toFixed(1)} % of her height)`,
    `knee at ${up(LANDMARKS.knee).toFixed(1)} %, jeans hem / boot top at ${up(LANDMARKS.hem).toFixed(1)} % (boots ${share(t.floor - LANDMARKS.hem)}, ankle skin a few rows)`,
    `arms (held out in the A-pose): elbow ${up(LANDMARKS.elbow).toFixed(1)} %, wrist ${up(LANDMARKS.wrist).toFixed(1)} %, fingertips ${up(LANDMARKS.fingertips).toFixed(1)} %`,
  ]
  for (const [name, w] of Object.entries(t.widths))
    lines.push(
      `${name}: ${w} px = ${((w / H) * 100).toFixed(1)} % of her height, ${(w / head).toFixed(2)} heads`,
    )
  return lines
}

/** The turnaround with the landmark rows drawn across the front figure (so the numbers can be checked by eye). */
export function marked(t: Raster, m: Turnaround): Raster {
  const out = crop(t, 0, 0, t.w, t.h)
  const line = (y: number, label: string) => {
    fill(out, 0, y, 560, 1, MARK)
    text(out, label, 566, y - 6, 2, MARK)
  }
  line(m.top, 'TOP')
  for (const [k, y] of Object.entries(LANDMARKS)) line(y, k.toUpperCase())
  line(m.crotch, 'CROTCH')
  line(m.floor, 'FLOOR')
  return crop(out, 0, 0, 760, t.h)
}

const REF = 'docs/art'

export function board(root: string): Raster {
  const load = (file: string) => decodePng(readFileSync(join(root, file)))
  const turnaround = load(`${REF}/ada-3d/turnaround.png`)
  const anchor = load(`${REF}/ada-3d/detail/identity-anchor.png`)
  const dir = (yaw: number) => load(`${REF}/ada-directions/approved-${yaw}.png`)
  const portrait = (name: string) => load(`${REF}/portraits/out/ada-${name}.png`)

  const generated = strip('GENERATED REFERENCES OF ADA (THE TARGET) - OLD GAME, 92E6704', [
    captioned(downscale(turnaround, 0.85), [
      'ADA-3D/TURNAROUND.PNG 1536X1024',
      'CONCEPT ART, FRONT RIGHT BACK, A-POSE',
      'THE TARGET FOR PROPORTIONS AND FACE',
    ]),
    captioned(downscale(load(`${REF}/character-reference-crop.png`), 0.55), [
      'CHARACTER-REFERENCE-CROP 680X920',
      'BACK, CANDLE (AN INPUT)',
    ]),
    captioned(downscale(anchor, 0.5), [
      'ADA-3D/DETAIL/IDENTITY-ANCHOR.PNG',
      '1536X1024, OWNER-PICKED FRONT STRIP',
    ]),
  ])
  const dirs = grid(
    'PER-DIRECTION STRIPS (1536X1024 EACH): STAND, STEP, STAND, STEP',
    [0, 45, 90, 135, 180, 225, 270, 315].map((yaw) =>
      captioned(downscale(dir(yaw), 0.34), [`APPROVED-${yaw}`]),
    ),
    4,
  )
  const portraits = strip(
    'PORTRAITS/OUT, 1024X1024, NURSE UNIFORM (GATE ART-PORTRAIT 2026-10-11): THE FACE',
    ['neutral', 'firm', 'afraid', 'worried', 'sad', 'surprised', 'inner'].map((n) =>
      captioned(downscale(portrait(n), 0.3), [`ADA-${n.toUpperCase()}`]),
    ),
  )

  // What was shipped: the old game's atlas (48 by 72 cells, 4 columns, 8 direction rows) and its procedural review sheet. Not the target.
  const atlas = load('public/art/character.png')
  const review = load(`${REF}/ada-figure/ada-review.png`)
  const shipped = strip('WHAT WAS SHIPPED, NOT THE TARGET (THE IMAGES ABOVE WIN)', [
    ...[0, 1, 2, 4].map((r) =>
      captioned(enlarge(crop(atlas, 0, r * 72, 48, 72), 4), [`OLD ATLAS ROW ${r}`, 'PUBLIC/ART/CHARACTER']),
    ),
    ...[6, 0].map((r) =>
      captioned(enlarge(oldCell(review, [48, 72], r, 0), 4), [
        r === 6 ? 'OLD PROCEDURAL' : 'OLD ATLAS (REVIEW)',
        'ADA-FIGURE/ADA-REVIEW',
      ]),
    ),
    captioned(downscale(load(`${REF}/ada-3d/detail/painted-0.png`), 0.34), [
      'ADA-3D/DETAIL/PAINTED-0.PNG 1536X1024',
      'THE DETAIL PASS THE ATLAS CAME FROM',
    ]),
  ])
  const parts = [generated, dirs, portraits, shipped]
  const out = newRaster(
    Math.max(...parts.map((p) => p.w)),
    parts.reduce((h, p) => h + p.h, 0),
  )
  fill(out, 0, 0, out.w, out.h, BACK)
  let y = 0
  for (const p of parts) {
    blit(out, p, 0, y, 1)
    y += p.h
  }
  return out
}

if (process.argv[1]?.endsWith('figure-reference.ts')) {
  const args = process.argv.slice(2)
  const oldAt = args.indexOf('--old')
  const out = args[0]
  const root = oldAt < 0 ? undefined : args[oldAt + 1]
  if (out === undefined || root === undefined)
    throw new Error('usage: figure-reference <out-dir> --old <old-game-checkout>')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'ref-board.png'), encodePng(board(root)))
  const t = decodePng(readFileSync(join(root, `${REF}/ada-3d/turnaround.png`)))
  const m = measureTurnaround(t)
  writeFileSync(join(out, 'ref-turnaround-marked.png'), encodePng(marked(t, m)))
  const lines = specNumbers(m)
  writeFileSync(join(out, 'ref-spec-numbers.txt'), `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))
}
