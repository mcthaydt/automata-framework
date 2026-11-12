// The framing study's contact sheet: the in-game frames side by side at 1024 by 768 (scaled to a fifth less), her face cropped at x4 under
// each, and the numbers of each framing. The frames are shot by `games/the-last-light/tests/e2e/framing.test.ts` under the study patch
// (`framing-study.patch`); the numbers are the camera's own, from the lens, the distance, the tilt and the field. Nothing is typed by hand
// but the crops' centres, which are read off the frames.
//
//   pnpm --filter @automata/character-kit framing <frames-dir> <out-file>
import { readFileSync, writeFileSync } from 'node:fs'
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
import { captioned, downscale, enlarge } from './figure-reference.ts'

export interface Framing {
  readonly id: string
  readonly name: string
  readonly lens: number
  readonly distance: number
  readonly tilt: number
  readonly field: readonly [number, number]
  readonly density: 1 | 2
  /** Her height in metres (the cast's 154 cm by default, the rebuilt Ada's 162). */
  readonly her?: number
  /** Where her face is in the 1024 by 768 frame (read off it), for the x4 crop. */
  readonly face: readonly [number, number]
}

const WINDOW = [1024, 768] as const
/** Her height in metres as the painter draws her (the cast's `height` slider, 154 cm today). */
const HER = 1.54

/** The camera's numbers for a framing: what the picture shows and what a pixel of it is. */
export function numbersOf(f: Framing) {
  const hvis = (f.distance * 24) / f.lens // metres, perpendicular to the axis, at the focus
  const lines = f.field[1] / hvis // field lines a metre
  const across = hvis * (f.field[0] / f.field[1])
  const tilt = (f.tilt * Math.PI) / 180
  const scale = WINDOW[0] / f.field[0]
  return {
    herRows: Math.round((f.her ?? HER) * Math.cos(tilt) * lines),
    across,
    deep: hvis / Math.sin(tilt),
    lines,
    /** Field lines a metre of floor, across the room and in depth: the floor's texel size is a field pixel, so these are its texels a metre. */
    floorAcross: lines,
    floorDeep: lines * Math.sin(tilt),
    lcd: scale, // the game's `lcd.cell` is 1 field pixel
    scale,
    pixels: f.field[0] * f.field[1],
    figureTexelsPerFieldPixel: ((f.density === 2 ? 74 : 37) / lines).toFixed(2),
  }
}

function frame(dir: string, id: string): Raster {
  return decodePng(readFileSync(join(dir, `round8-frame-${id}.png`)))
}

export function sheet(dir: string, framings: readonly Framing[]): Raster {
  const panels = framings.map((f) => {
    const n = numbersOf(f)
    const shot = frame(dir, f.id)
    const face = crop(shot, Math.round(f.face[0] - 40), Math.round(f.face[1] - 32), 80, 64)
    return {
      picture: captioned(downscale(shot, 0.5), [`${f.id.slice(0, 2).toUpperCase()} ${f.name.toUpperCase()}`]),
      face: captioned(enlarge(face, 4), [`HER FACE X4, ${n.herRows} ROWS TALL`]),
    }
  })
  const top = Math.max(...panels.map((p) => p.picture.h))
  const faceH = Math.max(...panels.map((p) => p.face.h))
  const cols = panels.map((p) => Math.max(p.picture.w, p.face.w))
  const rows = [
    ['', ...framings.map((f) => f.id.toUpperCase())],
    ['LENS / DISTANCE / TILT', ...framings.map((f) => `${f.lens}MM / ${f.distance}M / ${f.tilt}`)],
    ['FIELD, SHOWN AT', ...framings.map((f) => `${f.field[0]}X${f.field[1]} AT ${numbersOf(f).scale}X`)],
    ['HER ROWS (FIGURE D)', ...framings.map((f) => `${numbersOf(f).herRows} (D${f.density})`)],
    [
      'METRES ACROSS X DEEP',
      ...framings.map((f) => `${numbersOf(f).across.toFixed(1)} X ${numbersOf(f).deep.toFixed(1)}`),
    ],
    [
      'FLOOR TEXELS/M ACROSS, DEEP',
      ...framings.map((f) => `${numbersOf(f).floorAcross.toFixed(0)}, ${numbersOf(f).floorDeep.toFixed(0)}`),
    ],
    ['LCD CELL (SCREEN PX)', ...framings.map((f) => `${numbersOf(f).lcd}`)],
    ['FIELD PIXELS (COST)', ...framings.map((f) => `${(numbersOf(f).pixels / 1000).toFixed(0)}K`)],
    ['FIGURE TEXELS PER FIELD PX', ...framings.map((f) => `${numbersOf(f).figureTexelsPerFieldPixel}`)],
  ]
  const labelW = 400
  const lineH = textHeight(2) + 8
  const W = labelW + cols.reduce((a, b) => a + b + 8, 0)
  const H = top + faceH + 24 + rows.length * lineH + 16
  const out = newRaster(W, H)
  fill(out, 0, 0, W, H, [30, 33, 35, 255])
  let x = labelW
  for (const [i, p] of panels.entries()) {
    blit(out, p.picture, x, 8, 1)
    blit(out, p.face, x, top + 16, 1)
    x += (cols[i] ?? 0) + 8
  }
  for (const [r, row] of rows.entries()) {
    const y = top + faceH + 32 + r * lineH
    text(out, row[0] ?? '', 8, y, 2, [225, 225, 215, 255])
    let cx = labelW
    for (const [i, cell] of row.slice(1).entries()) {
      text(out, cell, cx + 6, y, 2, [225, 225, 215, 255])
      cx += (cols[i] ?? 0) + 8
    }
  }
  return out
}

export const FRAMINGS: readonly Framing[] = [
  {
    id: 'f1-today',
    name: 'today',
    lens: 50,
    distance: 16.6,
    tilt: 30,
    field: [512, 384],
    density: 1,
    face: [566, 292],
  },
  {
    id: 'f2-lens100',
    name: '100 mm lens',
    lens: 100,
    distance: 16.6,
    tilt: 30,
    field: [512, 384],
    density: 2,
    face: [612, 238],
  },
  {
    id: 'f3-field1024',
    name: 'field 1024x768',
    lens: 50,
    distance: 16.6,
    tilt: 30,
    field: [1024, 768],
    density: 2,
    face: [562, 300],
  },
  {
    id: 'f4-mixed',
    name: 'mixed density',
    lens: 50,
    distance: 16.6,
    tilt: 30,
    field: [512, 384],
    density: 2,
    face: [560, 292],
  },
  {
    id: 'f5-lens70-tilt25',
    name: '70 mm, tilt 25',
    lens: 70,
    distance: 16.6,
    tilt: 25,
    field: [512, 384],
    density: 2,
    face: [586, 286],
  },
]

/** The same views with the rebuilt Ada of round 8 (`?ada=b` in the study patch): mixed density at today's field, a 100 mm lens, the 1024 by 768 field. */
export const FRAMINGS_B: readonly Framing[] = [
  {
    id: 'b1-today',
    name: 'rebuilt: today field, density 2 (mixed)',
    lens: 50,
    distance: 16.6,
    tilt: 30,
    field: [512, 384],
    density: 2,
    her: 1.62,
    face: [568, 310],
  },
  {
    id: 'b2-lens100',
    name: 'rebuilt: 100 mm lens',
    lens: 100,
    distance: 16.6,
    tilt: 30,
    field: [512, 384],
    density: 2,
    her: 1.62,
    face: [516, 232],
  },
  {
    id: 'b3-field1024',
    name: 'rebuilt: field 1024x768',
    lens: 50,
    distance: 16.6,
    tilt: 30,
    field: [1024, 768],
    density: 2,
    her: 1.62,
    face: [562, 316],
  },
]

if (process.argv[1]?.endsWith('figure-framing.ts')) {
  const [dir, out] = process.argv.slice(2)
  if (dir === undefined || out === undefined) throw new Error('usage: figure-framing <frames-dir> <out-file>')
  writeFileSync(out, encodePng(sheet(dir, FRAMINGS)))
  writeFileSync(out.replace(/\.png$/, '-b.png'), encodePng(sheet(dir, FRAMINGS_B)))
}
