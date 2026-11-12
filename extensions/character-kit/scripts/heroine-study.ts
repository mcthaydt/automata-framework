// The painter-look showcase: the study figure ("the heroine") dressed from the runway wardrobe's garment kinds and drawn through the
// kit's door beside the untouched base woman, at one density, with the heroine at density 2 and 1 beneath her (does she still read).
// Not a golden. The painter's options it shows are the audit's (docs/superpowers/audits/2026-11-12-painter-figure-look).
//
//   pnpm --filter @automata/character-kit exec tsx scripts/heroine-study.ts <out-dir> [density] [file]
//
// Left: the base woman. Right: the heroine. Each: front and three-quarter standing (x2), the head and shoulders (x4).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { registerFashion } from '../src/features/fashion/register-fashion.ts'
import {
  BASE,
  type CharacterDef,
  Figure,
  type Garment,
  HAIR_STYLES,
  type HairStyle,
  type Material,
  member,
  SPRITE_PITCH,
  SWATCHES,
} from '../src/shared/figures/door.ts'
import { bbox, blit, png } from './sheet-kit.ts'

const out = resolve(process.argv[2] ?? 'out'),
  D = Number(process.argv[3] ?? 4),
  file = process.argv[4] ?? `showcase-d${D}.png`
mkdirSync(out, { recursive: true })
registerFashion()

/** The study figure's cloths, in DUEL steps (the painter's own study script has the same data): oxblood, cream, washed denim, auburn. */
const CLOTH = {
  oxblood: { ramp: 19, base: 1, lift: 0, paint: ['#662b29', '#49251c', '#372423', '#2e1026'] },
  cream: { ramp: 4, base: 1, paint: ['#fff3d6', '#eadbc9', '#ccc3b1', '#a89d8f'] },
  washedDenim: { ramp: 7, base: 1, paint: ['#828b98', '#626871', '#434549', '#2e3d47'] },
  auburn: { ramp: 20, base: 1, paint: ['#885041', '#662b29', '#49251c', '#2e1026'] },
} as unknown as Record<string, Material>
/** A fringe over the brow, and the full bob under it: the painter's own pieces. */
const FRINGE = {
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
}
const HAIR: HairStyle = {
  about: 'bobFull with a fringe',
  finish: 'smooth',
  pieces: [...(HAIR_STYLES.bobFull?.pieces ?? []), FRINGE as never],
}
/** The study figure: the builder's base woman set to the look spec (7 heads, a slim adult, a small oval face with large almond eyes). */
const WOMAN = BASE[1]?.def as CharacterDef
const HEROINE: CharacterDef = {
  ...WOMAN,
  id: 'heroine',
  name: 'HEROINE',
  skin: 'skinFair',
  sliders: {
    ...WOMAN.sliders,
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
    face: {
      ...(WOMAN.sliders.face ?? {}),
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
    },
  } as CharacterDef['sliders'],
  gaitOverrides: { armOut: 0.03, standOut: 0.03, standTrack: 1 } as NonNullable<
    CharacterDef['gaitOverrides']
  >,
  swatches: { ...WOMAN.swatches, ...CLOTH, skinFair: SWATCHES.skinFair as Material },
  // A cream shirt (a collar, long sleeves with cuffs), an oxblood waistcoat over it (a sleeveless knit shell standing a texel off), slim jeans, ankle boots.
  outfits: {
    street: [
      { top: 'cream', sleeves: 'long', cuffs: 'cream', collar: 'cream' },
      { tee: 'oxblood', sleeves: 'none', ease: 0.9, length: 0.35 },
      { jeans: 'washedDenim', taper: 0.8 },
      { shoes: 'leatherBrown', sole: 'soleGum', boots: true, shaft: 0.2 },
      { hair: 'auburn', style: HAIR },
      { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'auburn', keep: true, full: true },
    ] as unknown as Garment[],
  },
  default: 'street',
}
/** The painter's style for the heroine: the outline in the old game's dark teal. */
const PAINT = { ink: '#002219' }

type Paint = Record<string, unknown>
const stand = (def: CharacterDef, d: number, density: number, paint: Paint = {}) => {
  const cast = member(def, density),
    f = new Figure(cast)
  Object.assign(f.paintStyle, paint)
  for (let i = 0; i < 3; i++)
    f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: { azimuth: 0, pitch: SPRITE_PITCH } })
  return { px: f.painted.slice() as Uint8ClampedArray, w: cast.cell[0], h: cast.cell[1] }
}

const ZB = D > 4 ? 1 : 2,
  C = Math.round((100 * D) / 4),
  ZH = Math.max(1, Math.floor(400 / C)),
  W = Math.round(32.5 * D),
  COLW = 2 * W * ZB + C * ZH + 30,
  SW = COLW * 2 + 40,
  figH = Math.round(66 * D) * ZB + 40,
  stripH = 300,
  SH = figH + stripH + 20
const sheet = new Uint8Array(SW * SH * 4)
for (let i = 0; i < sheet.length; i += 4) {
  sheet[i] = 0x26
  sheet[i + 1] = 0x28
  sheet[i + 2] = 0x2b
  sheet[i + 3] = 255
}
const rows: Record<string, number> = {}
;[
  { def: WOMAN, paint: {}, x: 0, name: 'base woman' },
  { def: HEROINE, paint: PAINT, x: COLW + 40, name: 'heroine' },
].forEach(({ def, paint, x, name }) => {
  const f0 = stand(def, 0, D, paint),
    f1 = stand(def, 1, D, paint),
    bb = bbox(f0.px, f0.w, f0.h),
    cx = Math.round((bb.x0 + bb.x1) / 2),
    h = bb.y1 - bb.y0 + 1
  rows[name] = h
  const z = ZB,
    top = bb.y0 - 4
  blit(sheet, SW, f0.px, f0.w, [cx - W / 2, top, W, h + 8], x, 10, z)
  blit(sheet, SW, f1.px, f1.w, [cx - W / 2, top, W, h + 8], x + W * z, 10, z)
  blit(sheet, SW, f0.px, f0.w, [Math.round(cx - C / 2), top, C, C], x + W * z * 2 + 10, 10, ZH)
  if (name === 'heroine') {
    // The same figure at density 2 and 1, at the sizes they are played at (x2 and x4: about the size of the large figure's x1).
    let sx = x
    for (const [sd, sz] of [
      [2, 2],
      [1, 4],
    ] as const)
      for (const d of [0, 1]) {
        const s = stand(def, d, sd, paint),
          sb = bbox(s.px, s.w, s.h),
          w = 26 * sd + 12
        blit(
          sheet,
          SW,
          s.px,
          s.w,
          [Math.round((sb.x0 + sb.x1) / 2 - w / 2), sb.y0 - 2, w, sb.y1 - sb.y0 + 4],
          sx,
          figH + 20,
          sz,
        )
        sx += w * sz + 10
      }
  }
})
writeFileSync(join(out, file), png(sheet, SW, SH))
console.log(file, JSON.stringify(rows), `${SW}x${SH}`)
