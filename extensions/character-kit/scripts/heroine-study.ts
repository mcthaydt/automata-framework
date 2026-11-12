// The painter-look showcase: the study figure ("the heroine") dressed from the runway wardrobe's garment kinds and drawn through the
// kit's door beside the untouched base woman, at one density, with the heroine at density 2 and 1 beneath her (does she still read).
// Not a golden. The painter's options it shows are the audit's (docs/superpowers/audits/2026-11-12-painter-figure-look).
//
//   pnpm --filter @automata/character-kit exec tsx scripts/heroine-study.ts <out-dir> [density] [file]
//
// Left: the base woman. Right: the heroine. Each: front and three-quarter standing (x2), the head and shoulders (x4).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { FULL, study } from '../../figures/scripts/painter-look-study.ts'
import { registerFashion } from '../src/features/fashion/register-fashion.ts'
import {
  BASE,
  type CharacterDef,
  Figure,
  type Garment,
  member,
  SPRITE_PITCH,
} from '../src/shared/figures/door.ts'
import { bbox, blit, png } from './sheet-kit.ts'

const out = resolve(process.argv[2] ?? 'out'),
  D = Number(process.argv[3] ?? 4),
  file = process.argv[4] ?? `showcase-d${D}.png`
mkdirSync(out, { recursive: true })
registerFashion()

/** The heroine: the study figure's body, face, skin and hair, in the runway's shells: a cream shirt, an oxblood waistcoat over it (a sleeveless knit shell standing off the shirt), slim jeans, ankle boots. */
const WEAR = [
  { top: 'cream', sleeves: 'long', cuffs: 'cream', collar: 'cream' },
  { tee: 'oxblood', sleeves: 'none', ease: 0.9, length: 0.35 },
  { jeans: 'washedDenim', taper: 0.8 },
  { shoes: 'leatherBrown', sole: 'soleGum', boots: true, shaft: 0.2 },
] as unknown as Garment[]
const own = study(FULL)
const kept = (own.outfits.street ?? []).filter((g) => 'hair' in g || 'eyes' in g)
const HEROINE: CharacterDef = { ...own, outfits: { ...own.outfits, street: [...WEAR, ...kept] } }

type Paint = Record<string, unknown>
const stand = (def: CharacterDef, d: number, density: number, paint: Paint = {}) => {
  const cast = member(def, density),
    f = new Figure(cast)
  Object.assign(f.paintStyle, paint)
  for (let i = 0; i < 3; i++)
    f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: { azimuth: 0, pitch: SPRITE_PITCH } })
  return { px: f.painted.slice() as Uint8ClampedArray, w: cast.cell[0], h: cast.cell[1] }
}

const COLW = 920,
  SW = COLW * 2 + 40,
  figH = Math.round(66 * D) * 2 + 40,
  stripH = 300,
  SH = figH + stripH + 20
const sheet = new Uint8Array(SW * SH * 4)
for (let i = 0; i < sheet.length; i += 4) {
  sheet[i] = 0x26
  sheet[i + 1] = 0x28
  sheet[i + 2] = 0x2b
  sheet[i + 3] = 255
}
const W = Math.round(32.5 * D)
const rows: Record<string, number> = {}
;[
  { def: BASE[1].def, paint: {}, x: 0, name: 'base woman' },
  { def: HEROINE, paint: FULL.paint ?? {}, x: COLW + 40, name: 'heroine' },
].forEach(({ def, paint, x, name }) => {
  const f0 = stand(def, 0, D, paint),
    f1 = stand(def, 1, D, paint),
    bb = bbox(f0.px, f0.w, f0.h),
    cx = Math.round((bb.x0 + bb.x1) / 2),
    h = bb.y1 - bb.y0 + 1
  rows[name] = h
  const z = 2,
    top = bb.y0 - 4
  blit(sheet, SW, f0.px, f0.w, [cx - W / 2, top, W, h + 8], x, 10, z)
  blit(sheet, SW, f1.px, f1.w, [cx - W / 2, top, W, h + 8], x + W * z, 10, z)
  blit(sheet, SW, f0.px, f0.w, [cx - 50, top, 100, 100], x + W * z * 2 + 10, 10, 4)
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
