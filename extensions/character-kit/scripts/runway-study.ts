// A study sheet of the runway cast, drawn through the kit's door at density 4 (a head of 50 to 60 texels): for the eye, to judge
// the wardrobe's look against the Owner's bar (docs/superpowers/audits/2026-11-12-painter-figure-look). Not a golden: it records
// nothing and reads nothing back.
//
//   pnpm --filter @automata/character-kit exec tsx scripts/runway-study.ts <out-dir> [density]
//
// Each model: front and three-quarter standing (x2) and the head and shoulders (x4), one PNG for models 0 to 3 and one for 4 to 7.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { registerFashion } from '../src/features/fashion/register-fashion.ts'
import { RUNWAY_CAST } from '../src/features/fashion/runway-cast.ts'
import { member, standing } from '../src/shared/figures/door.ts'
import { bbox, blit, png } from './sheet-kit.ts'

const out = resolve(process.argv[2] ?? 'out'),
  D = Number(process.argv[3] ?? 4)
mkdirSync(out, { recursive: true })
registerFashion()

// Heads only (`heads` as the third argument): every model's head and shoulders at one size on the sheet, whatever the density.
if (process.argv[4] === 'heads') {
  const C = Math.round((100 * D) / 4),
    Z = Math.max(1, Math.floor(400 / C)),
    PX = C * Z
  const SW = PX * 4,
    SH = PX * 2,
    sheet = new Uint8Array(SW * SH * 4)
  for (let i = 0; i < sheet.length; i += 4) {
    sheet[i] = 0x26
    sheet[i + 1] = 0x28
    sheet[i + 2] = 0x2b
    sheet[i + 3] = 255
  }
  RUNWAY_CAST.forEach(({ def }, i) => {
    const cast = member(def, D),
      f0 = standing(cast, 0),
      bb = bbox(f0, cast.cell[0], cast.cell[1])
    blit(
      sheet,
      SW,
      f0,
      cast.cell[0],
      [Math.round((bb.x0 + bb.x1) / 2 - C / 2), bb.y0 - 4, C, C],
      (i % 4) * PX,
      Math.floor(i / 4) * PX,
      Z,
    )
  })
  writeFileSync(join(out, `runway-d${D}-heads.png`), png(sheet, SW, SH))
  process.exit(0)
}
const W = Math.round(32.5 * D)
for (let part = 0; part < RUNWAY_CAST.length; part += 4) {
  const models = RUNWAY_CAST.slice(part, part + 4),
    cw = 2 * (W * 2) + 100 * 4 + 30,
    rowH = Math.round(150 * D) + 20,
    SW = cw * 2,
    SH = rowH * 2
  const sheet = new Uint8Array(SW * SH * 4)
  for (let i = 0; i < sheet.length; i += 4) {
    sheet[i] = 0x26
    sheet[i + 1] = 0x28
    sheet[i + 2] = 0x2b
    sheet[i + 3] = 255
  }
  models.forEach(({ def }, i) => {
    const cast = member(def, D),
      [cellW, cellH] = cast.cell,
      f0 = standing(cast, 0),
      f1 = standing(cast, 1),
      bb = bbox(f0, cellW, cellH),
      cx = Math.round((bb.x0 + bb.x1) / 2),
      ox = (i % 2) * cw,
      oy = Math.floor(i / 2) * rowH
    const h = bb.y1 - bb.y0 + 1
    // front, three-quarter: x1 when the figure is over 300 rows tall (so a row fits), else x2.
    const z = 1
    blit(sheet, SW, f0, cellW, [cx - W / 2, bb.y0 - 4, W, h + 8], ox, oy, z * 2)
    blit(sheet, SW, f1, cellW, [cx - W / 2, bb.y0 - 4, W, h + 8], ox + W * 2, oy, z * 2)
    blit(sheet, SW, f0, cellW, [cx - 50, bb.y0 - 4, 100, 100], ox + W * 4 + 10, oy, 4)
    console.log(def.id, 'head+hair rows', 'figure rows', h)
  })
  writeFileSync(join(out, `runway-d${D}-${part / 4}.png`), png(sheet, SW, SH))
}
