/**
 * The c5-finish visual gate: the base man in test-fixture denim (a twill on the shorts) and in a dark gloss (black
 * leather on a top), at D2 and D4, in four views (front, three-quarter, back, a walk frame at three-quarter back),
 * unlit and at the runway's night under one overhead spot. One PNG per subject, density and lighting, one row of four
 * cells, upscaled nearest by 8/D. Test fixtures only: this registers nothing in src/.
 *
 *   npm run c5 -- DIR                        the render
 *   npm run c5 -- DIR --pair BEFORE_DIR      each of DIR's PNGs under the same PNG of BEFORE_DIR (before above, after
 *                                            below), written beside DIR (in its parent), and the crops sheets
 *                                            crops-D2.png, crops-D4.png there too
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { BASE, Figure, type Lighting, lightFigure, member, TIMES, view } from '../src'
import type { Material } from '../src/features/body/parts'
import type { CharacterDef } from '../src/features/figure/cast'
import type { Garment } from '../src/features/outfit/garments'
import { FIXTURES, registerFixtures } from '../tests/features/paint/fabric-fixtures'

registerFixtures()
const args = process.argv.slice(2),
  pair = args.indexOf('--pair')
const outDir = resolve(args.find((a, i) => !a.startsWith('--') && (pair < 0 || i !== pair + 1)) ?? 'out/c5')
const beforeDir = pair >= 0 ? resolve(args[pair + 1]) : null
mkdirSync(outDir, { recursive: true })

const dress = (garments: Garment[], swatches: Record<string, Material>): CharacterDef => {
  const base = BASE[0].def
  return { ...base, outfits: { [base.default]: garments }, swatches: { ...base.swatches, ...swatches } }
}
/** Subjects: the base man in `garments`, the swatches they name. */
const SUBJECTS: Record<string, CharacterDef> = {
  denim: dress([{ top: 'tee', sleeves: 'short' }, { shorts: 'denim' }], {
    denim: { ramp: 26, base: 3, fabric: 'fx-twill' },
    tee: { ramp: 10, base: 6 },
  }),
  leather: dress([{ top: 'leather', sleeves: 'long' }, { shorts: 'plain' }], {
    leather: { ramp: 0, base: 1, gloss: 0.5 },
    plain: { ramp: 10, base: 3 },
  }),
}
if ('twillHanded' in FIXTURES)
  SUBJECTS.denimHanded = dress([{ top: 'tee', sleeves: 'short' }, { shorts: 'denim' }], {
    denim: { ramp: 26, base: 3, fabric: 'fx-twillHanded' },
    tee: { ramp: 10, base: 6 },
  })

/** The runway's night and its spot. */
const NIGHT: Lighting = {
  time: TIMES.night,
  lamps: [
    { at: [0, 3.2, 0.6], color: '#fff3d6', steps: 3, radius: 4, tint: 0.35, aim: [0, -1, 0], cone: 26 },
  ],
  t: 0,
  bounce: { floor: 0x5b5c69 },
}
const GROUND = [0x28, 0x33, 0x5d]
const PITCH = (18 * Math.PI) / 180
const CELLS: [string, number][] = [
  ['front', 0],
  ['three-quarter', 1],
  ['back', 4],
  ['walk', 3],
]

/** One cell: the figure facing view d (a walk frame when `walk`), lit or not, on the ground colour. */
function cell(
  def: CharacterDef,
  D: number,
  d: number,
  walk: boolean,
  lighting: Lighting | null,
): Uint8ClampedArray {
  const cast = member(def, D),
    f = new Figure({ ...cast, blink: 0 })
  f.cache = false
  const input = { facing: (d * Math.PI) / 4, moving: walk, view: view(PITCH) }
  if (walk) {
    // The walk's pose floor(n/4): the figure's own phase, kept in step as frames.ts walking() does.
    const dt = 1 / 60,
      target = Math.floor(cast.gait.walkPoses / 4)
    let phase = 0
    for (let i = 0; i < Math.round(cast.gait.cycle * 4 * 60); i++) {
      phase = (phase + dt / cast.gait.cycle) % 1
      f.update(dt, input)
      if (i > cast.gait.cycle * 2 * 60 && Math.floor(phase * cast.gait.walkPoses) === target) break
    }
  } else for (let i = 0; i < 3; i++) f.update(1 / 60, input)
  const px = lighting ? lightFigure(f, lighting) : f.painted,
    out = new Uint8ClampedArray(px.length)
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(px[i + c] * a + GROUND[c] * (1 - a))
    out[i + 3] = 255
  }
  return out
}

const render = (subject: string, D: number, lighting: Lighting | null) => {
  const [W, H] = member(SUBJECTS[subject], D).cell,
    scale = 8 / D
  const c = createCanvas(W * CELLS.length * scale, H * scale),
    ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  CELLS.forEach(([, d], i) => {
    const tile = createCanvas(W, H),
      tc = tile.getContext('2d'),
      img = tc.createImageData(W, H)
    img.data.set(cell(SUBJECTS[subject], D, d, i === 3, lighting))
    tc.putImageData(img, 0, 0)
    ctx.drawImage(tile, i * W * scale, 0, W * scale, H * scale)
  })
  return c
}

if (!beforeDir) {
  for (const subject of Object.keys(SUBJECTS))
    for (const D of [2, 4])
      for (const [tag, lighting] of [
        ['unlit', null],
        ['night', NIGHT],
      ] as const) {
        const file = join(outDir, `${subject}-D${D}-${tag}.png`)
        writeFileSync(file, render(subject, D, lighting).toBuffer('image/png'))
        console.log(file)
      }
} else {
  const pairs = resolve(outDir, '..')
  const crops: Record<
    number,
    {
      label: string
      before: Awaited<ReturnType<typeof loadImage>>
      after: Awaited<ReturnType<typeof loadImage>>
      crop: [number, number, number, number]
    }[]
  > = { 2: [], 4: [] }
  for (const file of readdirSync(outDir).filter((f) => f.endsWith('.png') && !f.startsWith('crops'))) {
    const subject = file.split('-D')[0],
      D = Number(file.split('-D')[1][0])
    const beforeFile = join(beforeDir, file.replace(/^denimHanded/, 'denim'))
    const after = await loadImage(join(outDir, file)),
      before = await loadImage(beforeFile)
    const c = createCanvas(after.width, after.height * 2 + 24),
      ctx = c.getContext('2d')
    ctx.fillStyle = '#1d1d21'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#eadbc9'
    ctx.font = '14px sans-serif'
    ctx.fillText(`${file.replace('.png', '')}: before (top), after (bottom)`, 6, 16)
    ctx.drawImage(before, 0, 24)
    ctx.drawImage(after, 0, 24 + before.height)
    writeFileSync(join(pairs, file), c.toBuffer('image/png'))
    // The crops: the legs (denim) or the chest (leather) of every cell, at three-quarter and back, ×2 more.
    const cw = after.width / CELLS.length,
      ch = after.height
    const crop: [number, number, number, number] = subject.startsWith('denim')
      ? [0.2 * cw, 0.5 * ch, 0.6 * cw, 0.35 * ch]
      : [0.2 * cw, 0.3 * ch, 0.6 * cw, 0.2 * ch]
    if (file.includes('-night')) crops[D].push({ label: file.replace('.png', ''), before, after, crop })
  }
  for (const D of [2, 4]) {
    const rows = crops[D]
    if (!rows.length) continue
    const [, , cw, ch] = rows[0].crop,
      cells = CELLS.length,
      Z = 2
    const sheet = createCanvas(cw * cells * Z, rows.length * (ch * Z * 2 + 24)),
      sc = sheet.getContext('2d')
    sc.imageSmoothingEnabled = false
    sc.fillStyle = '#1d1d21'
    sc.fillRect(0, 0, sheet.width, sheet.height)
    sc.fillStyle = '#eadbc9'
    sc.font = '14px sans-serif'
    rows.forEach((r, i) => {
      const y0 = i * (ch * Z * 2 + 24),
        cellW = r.after.width / cells,
        [cx, cy, w, h] = r.crop
      sc.fillText(`${r.label}: before (top), after (bottom)`, 6, y0 + 16)
      for (let k = 0; k < cells; k++)
        for (const [n, img] of [
          [0, r.before],
          [1, r.after],
        ] as const)
          sc.drawImage(img, k * cellW + cx, cy, w, h, k * w * Z, y0 + 24 + n * h * Z, w * Z, h * Z)
    })
    writeFileSync(join(pairs, `crops-D${D}.png`), sheet.toBuffer('image/png'))
    console.log(join(pairs, `crops-D${D}.png`))
  }
}
