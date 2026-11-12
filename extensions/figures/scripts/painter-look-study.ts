/**
 * The painter-look study: ONE study figure, drawn from data only, before and after each painter option, so a person can
 * judge what the option changed. Not a golden: the pictures and the numbers are for the eye and for the README beside
 * them (docs/superpowers/audits/2026-11-12-painter-figure-look/).
 *
 *   pnpm --filter @automata/figures study <out-dir> <item>      # item: hair | skin | eyes | stand | outline | all
 *   pnpm --filter @automata/figures study <out-dir> base        # the untouched base pair, large (density 4)
 *
 * The figure is the builder's base woman set to the generated turnaround's look spec ("Ada, rebuilt", variant D of the
 * last-light figures audit): about 7 heads tall, her legs half her height, a slim adult, the turnaround's small oval face
 * with big almond eyes and thin brows, the arms near the body. Everything below is data. Where the reference's garment is the
 * character kit's and not the painter's (the waistcoat, the jeans, the boots), the nearest base garment stands in for it: a
 * top in the waistcoat's oxblood with the shirt's cream cuffs, shorts in the jeans' washed blue, bare feet. No per-character
 * code: this is the base woman and options.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { BASE } from '../src/shared/base/base-pair'
import { measure } from '../src/shared/body/genes'
import type { Material } from '../src/shared/body/parts'
import { type CharacterDef, fromDef } from '../src/shared/figure/cast'
import { Figure } from '../src/shared/figure/figure'
import { type Frame, member, view } from '../src/shared/figure/frames'
import { HAIR_STYLES, type HairStyle, type Piece, PPM } from '../src/shared/hair/hair'
import { type Garment, SWATCHES as SWATCHES_LIB } from '../src/shared/outfit/garments'
import { duel, FACE_SEAM, type PaintStyle, tonesOf } from '../src/shared/paint/paint'
import { hex } from '../src/shared/paint/paint-style'
import { largeSheet, sizes } from './study-large'

/** The base woman: the figure every character starts from. */
const WOMAN: CharacterDef = BASE[1].def

/** The reference's cloths in DUEL steps (ada-look-spec.md): an oxblood waistcoat, washed blue-grey denim, warm auburn hair. */
const SWATCHES: Record<string, Material> = {
  oxblood: { ramp: 19, base: 1, lift: 0, paint: ['#662b29', '#49251c', '#372423', '#2e1026'] },
  cream: { ramp: 4, base: 1, paint: ['#fff3d6', '#eadbc9', '#ccc3b1', '#a89d8f'] },
  washedDenim: { ramp: 7, base: 1, paint: ['#828b98', '#626871', '#434549', '#2e3d47'] },
  auburn: { ramp: 20, base: 1, paint: ['#885041', '#662b29', '#49251c', '#2e1026'] },
} as unknown as Record<string, Material>

/** The proportions of variant D: 162 cm, a slim adult, a head of 7 to the body, her legs just over half, the arms near her. */
const PROPORTIONS = {
  height: 162,
  fat: 0.1,
  chunk: 0,
  muscle: 0.3,
  legs: 0.38,
  head: 0.45,
  hips: 0.3,
  frame: 0.95,
  neckLength: 0.25,
  posture: 0.9,
  shoulders: 0.4,
}
/** The turnaround's face: a small oval, a soft chin, big almond eyes under a thin soft brow, a small nose and mouth. */
const FACE = {
  width: 0.5,
  jaw: 0.2,
  chin: 0.4,
  cheekHeight: 0.6,
  cheekWidth: 0.4,
  bridge: 0.4,
  nose: 0.3,
  lips: 0.45,
  browArch: 0.5,
  browWeight: 0.2,
  browHeight: 0.5,
  crease: 0.3,
  hood: 0.1,
  liner: 0.45,
  eyeSize: 0.7,
  eyeSpacing: 0.5,
  eyeTilt: 0.5,
}

/** What an item changes: the hair style (a library name or a style) and anything else laid over the study figure's data. */
export interface Look {
  readonly label: string
  readonly note: string
  readonly style: string | HairStyle
  /** Extra data over the figure (the painter's other options, as later items add them). */
  readonly patch?: (def: CharacterDef) => CharacterDef
  /** The painter's style over the defaults (`PaintStyle`), for a look drawn in another outline colour. */
  readonly paint?: Partial<PaintStyle>
}
/** The look being drawn: its paint style, laid over every figure this script paints. */
let painting: Partial<PaintStyle> = {}

/** A fringe over the brow: the study's one piece beside the bob's shell (hair.ts `Fringe`). */
const FRINGE: Piece = {
  fringe: {
    from: [
      [0, 0.5],
      [0.7, 0.45],
      [1.1, 0.3],
    ],
    width: 0.75,
    length: 1,
    count: 9,
    rope: { r: 0.15 },
  },
} as Piece
const shell = (name: string): Piece => HAIR_STYLES[name].pieces[0]
/** `bobFull` with a brow-length fringe: the library's shell and the painter's own fringe piece. */
const BOB_FULL_FRINGE: HairStyle = {
  about: 'bobFull with a fringe',
  finish: 'smooth',
  pieces: [shell('bobFull'), FRINGE],
}

/** The skin: a swatch (and the least share of the face in its lightest step, `Material.face.light`, if one is given). */
const skinned =
  (name: string, light?: number): Look['patch'] =>
  (def) => ({
    ...def,
    skin: `study-${name}`,
    swatches: {
      ...def.swatches,
      [`study-${name}`]: { ...SWATCHES_LIB[name], ...(light === undefined ? {} : { face: { light } }) },
    },
  })

/** A low fringe, to the cheekbone: past the brow, over the eyes (hair.ts `Fringe`, length 1.3). */
const LOW_FRINGE: HairStyle = {
  about: 'bobFull with a fringe past the brow',
  finish: 'smooth',
  pieces: [
    shell('bobFull'),
    { fringe: { ...(FRINGE as { fringe: object }).fringe, length: 1.3, count: 11 } } as Piece,
  ],
}
/** The `eyes` garment's options, and any change to the drawn face, laid over the study figure. */
const eyed =
  (extra: object, face: object = {}): Look['patch'] =>
  (def) => ({
    ...def,
    face: { ...def.face, ...face },
    outfits: {
      ...def.outfits,
      street: def.outfits.street.map((g) => ('eyes' in g ? ({ ...g, ...extra } as Garment) : g)),
    },
  })

/** A gait number or two over the study figure's own (the stand's feet and arms). */
const gaited =
  (over: object): Look['patch'] =>
  (def) => ({ ...def, gaitOverrides: { ...def.gaitOverrides, ...over } as CharacterDef['gaitOverrides'] })

/** Every look option on at once: the full bob and its fringe, the fair skin and its lit face, the eyes kept, a wider stand, dark ink. */
export const FULL: Look = {
  label: 'the study figure, every option on',
  note: 'bobFull + fringe, skinFair + face.light .6, eyes keep, standTrack 1, ink #002219',
  style: BOB_FULL_FRINGE,
  paint: { ink: '#002219' },
  patch: (def) =>
    gaited({ standTrack: 1 })?.(
      eyed({ keep: true, full: true })?.(skinned('skinFair', 0.6)?.(def) ?? def) ?? def,
    ) ?? def,
}

export const LOOKS: Readonly<Record<string, readonly Look[]>> = {
  stoop: [
    { label: 'before: the upright stand', note: 'the relaxed stand as it always was', style: 'bobFull' },
    {
      label: 'after: standStoop .35',
      note: 'the chest pitched forward .35 rad, the head half as far back up',
      style: 'bobFull',
      patch: gaited({ standStoop: 0.35 }),
    },
    {
      label: 'after: standStoop .7',
      note: 'a deep stoop',
      style: 'bobFull',
      patch: gaited({ standStoop: 0.7 }),
    },
  ],
  outline: [
    {
      label: 'before: black ink',
      note: 'the outline on the shadow side and under is DUEL black',
      style: 'bobFull',
    },
    {
      label: 'after: ink #002219',
      note: 'the same figure outlined in the old game’s dark teal (`PaintStyle.ink`)',
      style: 'bobFull',
      paint: { ink: '#002219' },
    },
    {
      label: 'after: ink #181f2f',
      note: 'a dark navy from DUEL',
      style: 'bobFull',
      paint: { ink: '#181f2f' },
    },
  ],
  stand: [
    {
      label: 'before: the relaxed stand',
      note: 'the feet at .75 of the hip joints’ half-width (today), the arms at standOut .03',
      style: 'bobFull',
    },
    {
      label: 'after: standTrack 1',
      note: 'the feet under the hip joints: the legs stand apart',
      style: 'bobFull',
      patch: gaited({ standTrack: 1 }),
    },
    {
      label: 'after: standTrack .5',
      note: 'the feet closer together',
      style: 'bobFull',
      patch: gaited({ standTrack: 0.5 }),
    },
    {
      label: 'after: standTrack 1, standOut .12',
      note: 'the legs apart and the arms a little further from the body (standOut, already a gait number)',
      style: 'bobFull',
      patch: gaited({ standTrack: 1, standOut: 0.12 }),
    },
  ],
  eyes: [
    {
      label: 'before: the drawn face under a low fringe',
      note: 'the fringe past the brow hides the eyes',
      style: LOW_FRINGE,
    },
    {
      label: 'after: keep',
      note: 'the same, with `keep`: the eyes drawn on the skin the fringe leaves',
      style: LOW_FRINGE,
      patch: eyed({ keep: true }),
    },
    {
      label: 'after: nose and mouth off',
      note: 'the drawn face with `nose: false` and `mouth: false`',
      style: 'bobFull',
      patch: eyed({ nose: false, mouth: false }),
    },
    {
      label: 'before: the eye marks of an undrawn face',
      note: 'decal eyes 1 by 1 at .42 of the half-width',
      style: 'bobFull',
      patch: eyed({}, { drawn: false }),
    },
    {
      label: 'after: mark size 1 by 2, x .6',
      note: 'the same eye mark 2 tall and set wider (`mark`)',
      style: 'bobFull',
      patch: eyed({ mark: { size: [1, 2], x: 0.6 } }, { drawn: false }),
    },
  ],
  skin: [
    {
      label: 'before: skinWarm',
      note: 'the painter’s warm skin: a face mostly the middle step',
      style: 'bobFull',
      patch: skinned('skinWarm'),
    },
    {
      label: 'after: skinFair',
      note: 'the warm peach on DUEL (#ffe2cf, #ebbd9d, #c7826c, #a76057), the face as the style budgets it',
      style: 'bobFull',
      patch: skinned('skinFair'),
    },
    {
      label: 'after: skinFair + face.light .6',
      note: 'the same skin, the least light share of the face .6: mostly its lightest step',
      style: 'bobFull',
      patch: skinned('skinFair', 0.6),
    },
    {
      label: 'after: skinWarm + face.light .6',
      note: 'the warm skin with the same option',
      style: 'bobFull',
      patch: skinned('skinWarm', 0.6),
    },
  ],
  hair: [
    {
      label: 'before: the library bob',
      note: 'the painter’s `bob` (a scalp and a fall of clumps)',
      style: 'bob',
    },
    {
      label: 'after: bobFull',
      note: 'one shell: crown a row or two over the skull, 1.2 heads wide, hem under, parting',
      style: 'bobFull',
    },
    {
      label: 'after: bobFull + fringe',
      note: 'the same shell with the painter’s brow-length fringe',
      style: BOB_FULL_FRINGE,
    },
  ],
}

/** The study figure, wearing a look. */
export function study(look: Look): CharacterDef {
  const outfit: Garment[] = [
    { top: 'oxblood', sleeves: 'short', cuffs: 'cream' },
    { shorts: 'washedDenim' },
    { hair: 'auburn', style: look.style },
    { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'auburn' },
  ] as Garment[]
  const def: CharacterDef = {
    ...WOMAN,
    id: 'study',
    name: 'STUDY',
    skin: 'skinWarm',
    sliders: { ...WOMAN.sliders, ...PROPORTIONS, face: { ...(WOMAN.sliders.face ?? {}), ...FACE } },
    gaitOverrides: { armOut: 0.03, standOut: 0.03 } as CharacterDef['gaitOverrides'],
    swatches: { ...WOMAN.swatches, ...SWATCHES },
    outfits: { street: outfit },
    default: 'street',
  }
  return look.patch ? look.patch(def) : def
}

// ─── Drawing ───
const HAIR = (p: number) => p >= 2000 && p < 3000
function stand(def: CharacterDef, d: number, D: number) {
  const cast = member(def, D),
    f = new Figure(cast)
  Object.assign(f.paintStyle, painting)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return { f, w: cast.cell[0], h: cast.cell[1], px: f.painted.slice() as Frame }
}
function walk(def: CharacterDef, D: number): Frame[] {
  const cast = member(def, D),
    f = new Figure({ ...cast, blink: 0 }),
    out: Frame[] = [],
    dt = 1 / 60
  Object.assign(f.paintStyle, painting)
  let phase = 0
  for (let i = 0; i < Math.round(cast.gait.cycle * 4 * 60); i++) {
    phase = (phase + dt / cast.gait.cycle) % 1
    f.update(dt, { facing: Math.PI / 4, moving: true, view: view() })
    out[Math.floor(phase * cast.gait.walkPoses)] = f.painted.slice()
  }
  return out
}

/** The numbers a look gives, measured on its own pictures (never typed). */
export function numbers(look: Look) {
  painting = look.paint ?? {}
  const def = study(look),
    bare = study({ ...look, style: { about: 'none', finish: 'smooth', pieces: [] } }),
    head = measure(def.sliders).genes.head * PPM,
    out: Record<string, number> = {}
  const top = (s: ReturnType<typeof stand>) => {
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.px[(y * s.w + x) * 4 + 3]) return y
    return -1
  }
  const widest = (s: ReturnType<typeof stand>) => {
    let m = 0
    for (let y = 0; y < s.h; y++) {
      let x0 = Number.POSITIVE_INFINITY,
        x1 = -1
      for (let x = 0; x < s.w; x++)
        if (s.px[(y * s.w + x) * 4 + 3] && HAIR(s.f.g.part[y * s.w + x])) {
          x0 = Math.min(x0, x)
          x1 = x
        }
      if (x1 >= 0) m = Math.max(m, x1 - x0 + 1)
    }
    return m
  }
  for (const [name, d] of [
    ['front', 0],
    ['side', 2],
    ['back', 4],
  ] as const) {
    const a = stand(def, d, 2),
      b = stand(bare, d, 2)
    out[`rows over the skull, ${name}`] = top(b) - top(a)
    out[`hair width in heads, ${name}`] = Math.round((widest(a) / head) * 100) / 100
  }
  const s = stand(def, 0, 2)
  let bottom = 0
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.px[(y * s.w + x) * 4 + 3]) bottom = y
  out['figure rows, density 2'] = bottom - top(s) + 1
  out['heads tall'] = Math.round(((bottom - top(s) + 1) / head) * 100) / 100
  // The stand: the width of the figure over its last 6 rows (its feet), and the gap between the legs at the knee, front, density 2.
  {
    let x0 = Number.POSITIVE_INFINITY,
      x1 = -1
    for (let y = bottom - 5; y <= bottom; y++)
      for (let x = 0; x < s.w; x++)
        if (s.px[(y * s.w + x) * 4 + 3]) {
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
        }
    out['feet span, front, D2 (texels)'] = x1 - x0 + 1
  }
  // The outline: the texels painted in the outline's colour, front, density 2, and its colour.
  {
    const ink = duel(hex(painting.ink ?? '#000000'))
    let n = 0
    for (let k = 0; k < s.w * s.h; k++)
      if (s.px[k * 4 + 3] && ((s.px[k * 4] << 16) | (s.px[k * 4 + 1] << 8) | s.px[k * 4 + 2]) === ink) n++
    out['outline texels, front, D2'] = n
    out['outline colour'] = ink
  }
  // The face's skin in its steps, light to deep (shares of its skin texels, front view): measured from the cell.
  const steps = tonesOf(def.swatches?.[def.skin] ?? SWATCHES_LIB[def.skin])
  for (const D of [1, 2]) {
    const f = stand(def, 0, D),
      count = [0, 0, 0, 0]
    let n = 0
    for (let k = 0; k < f.w * f.h; k++) {
      if (!f.px[k * 4 + 3] || f.f.g.part[k] !== FACE_SEAM) continue
      const q = steps.indexOf((f.px[k * 4] << 16) | (f.px[k * 4 + 1] << 8) | f.px[k * 4 + 2])
      if (q >= 0) {
        count[q]++
        n++
      }
    }
    count.forEach((c, i) => {
      out[`face skin, step ${['light', 'mid', 'shade', 'deep'][i]}, D${D} (share)`] =
        Math.round((c / (n || 1)) * 100) / 100
    })
  }
  return out
}

// ─── The sheet ───
const FONT = '14px sans-serif'
function put(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  px: Frame,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  crop?: [number, number, number, number],
) {
  const c = createCanvas(w, h),
    k = c.getContext('2d'),
    img = k.createImageData(w, h)
  img.data.set(px)
  k.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = false
  const [sx, sy, sw, sh] = crop ?? [0, 0, w, h]
  ctx.drawImage(c, sx, sy, sw, sh, x, y, sw * z, sh * z)
}

/** One look's sheet: 8 standing views and the walk at density 2, the face at x8 (front, 3/4, side), density 1 beside it. */
export function sheet(looks: readonly Look[], title: string): Buffer {
  const D2 = looks.map((l) => ({ l, def: study(l) })),
    cell = member(D2[0].def, 2).cell,
    w = cell[0],
    h = cell[1],
    Z = 2
  // The crop of the head: from its top, as wide as the cell, a head and a half tall.
  const probe = stand(D2[0].def, 0, 2)
  let top = 0
  for (let y = 0; y < h && !top; y++) for (let x = 0; x < w; x++) if (probe.px[(y * w + x) * 4 + 3]) top = y
  const faceH = 36,
    faceW = 40,
    fx = Math.round((w - faceW) / 2),
    ZF = 8
  const rowH = h * Z + 24
  const secH = rowH * 2 + faceH * ZF + 30 + 30 + (cell[1] / 2) * 4 + 30
  const W = Math.max(w * Z * 8, 3 * faceW * ZF + 40) + 20
  const c = createCanvas(W, 40 + secH * looks.length)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#26282b'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#e8e8e8'
  ctx.font = '20px sans-serif'
  ctx.fillText(title, 8, 26)
  ctx.font = FONT
  let y0 = 40
  for (const { l, def } of D2) {
    painting = l.paint ?? {}
    ctx.fillStyle = '#ffd479'
    ctx.fillText(`${l.label} — ${l.note}`, 8, y0 + 14)
    ctx.fillStyle = '#e8e8e8'
    y0 += 24
    for (let d = 0; d < 8; d++) {
      const s = stand(def, d, 2)
      put(ctx, s.px, w, h, d * w * Z, y0, Z)
    }
    y0 += h * Z
    const wk = walk(def, 2)
    wk.forEach((px, i) => {
      if (i < 8) put(ctx, px, w, h, i * w * Z, y0, Z)
    })
    y0 += h * Z + 6
    for (const [i, d] of [0, 1, 2].entries()) {
      const s = stand(def, d, 2)
      put(ctx, s.px, w, h, i * (faceW * ZF + 10), y0, ZF, [fx, top - 2, faceW, faceH])
    }
    y0 += faceH * ZF + 8
    // Density 1 (x4) beside density 2 (x2): the same size on the screen.
    const c1 = member(def, 1).cell
    ctx.fillStyle = '#9aa'
    ctx.fillText('density 1 at x4, front, 3/4, back', 8, y0 + 12)
    y0 += 16
    ;[0, 1, 4].forEach((d, i) => {
      const s = stand(def, d, 1)
      put(ctx, s.px, c1[0], c1[1], i * (c1[0] * 4 + 10), y0, 4)
    })
    // The face at density 1, front and 3/4, at x12: the size the face is played at, large enough to see its tones.
    const probe1 = stand(def, 0, 1)
    let top1 = 0
    for (let y = 0; y < c1[1] && !top1; y++)
      for (let x = 0; x < c1[0]; x++) if (probe1.px[(y * c1[0] + x) * 4 + 3]) top1 = y
    const fw = 20,
      fx1 = Math.round((c1[0] - fw) / 2)
    ;[0, 1].forEach((d, i) => {
      const s = stand(def, d, 1)
      put(ctx, s.px, c1[0], c1[1], 3 * (c1[0] * 4 + 10) + i * (fw * 12 + 10), y0, 12, [fx1, top1 - 1, fw, 16])
    })
    y0 += c1[1] * 4 + 10
  }
  return c.toBuffer('image/png')
}

// ─── Run ───
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const out = resolve(process.argv[2] ?? 'out'),
    item = process.argv[3] ?? 'all'
  mkdirSync(out, { recursive: true })
  if (item === 'd4') {
    const D = Number(process.env.DENSITY ?? 4)
    const entries = [
      { label: 'untouched BASE F', def: BASE[1].def },
      { label: FULL.label, def: study(FULL), paint: FULL.paint },
      {
        label: 'the same at about 5 heads (head .95, legs .15, neckLength .1, height 158)',
        def: study({
          ...FULL,
          patch: (def) => {
            const d = FULL.patch?.(def) ?? def
            return { ...d, sliders: { ...d.sliders, head: 0.95, legs: 0.15, neckLength: 0.1, height: 158 } }
          },
        }),
        paint: FULL.paint,
      },
    ]
    writeFileSync(
      join(out, `d${D}-sheet.png`),
      largeSheet(entries, {
        density: D,
        zoom: D > 4 ? 1 : 2,
        zoomHead: D > 4 ? 3 : 4,
        title: `the study figure and the base woman, density ${D}`,
      }),
    )
    const rows = entries.map((e) => ({ label: e.label, ...sizes(e.def, D, e.paint) }))
    writeFileSync(join(out, `d${D}-numbers.json`), `${JSON.stringify(rows, null, 2)}\n`)
    console.log('d4', JSON.stringify(rows))
  }
  if (item === 'base') {
    // The untouched base pair, large: DENSITY=<n> (default 4); above 4 the figures are drawn at x1 and the head at x2, to fit a sheet.
    const D = Number(process.env.DENSITY ?? 4)
    const entries = BASE.map((b) => ({ label: `untouched ${b.def.name}`, def: b.def }))
    writeFileSync(
      join(out, `base-d${D}-sheet.png`),
      largeSheet(entries, {
        density: D,
        zoom: D > 4 ? 1 : 2,
        zoomHead: D > 4 ? 2 : 4,
        title: `the base pair at density ${D}`,
      }),
    )
    const rows = entries.map((e) => ({ label: e.label, ...sizes(e.def, D) }))
    writeFileSync(join(out, `base-d${D}-numbers.json`), `${JSON.stringify(rows, null, 2)}\n`)
    console.log('base', JSON.stringify(rows))
  }
  for (const [name, looks] of Object.entries(LOOKS)) {
    if (item !== 'all' && item !== name) continue
    writeFileSync(join(out, `${name}-sheet.png`), sheet(looks, `painter look study: ${name}`))
    const rows = looks.map((l) => ({ label: l.label, ...numbers(l) }))
    writeFileSync(join(out, `${name}-numbers.json`), `${JSON.stringify(rows, null, 2)}\n`)
    console.log(name, JSON.stringify(rows))
  }
  void fromDef
}
